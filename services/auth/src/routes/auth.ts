import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { pool, redis } from '../index';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Helper: Generate tokens
function generateTokens(payload: { userId: string; email: string; role: string; memberId?: string }) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);

  const refreshToken = jwt.sign({ userId: payload.userId }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  } as jwt.SignOptions);

  return { accessToken, refreshToken };
}

// Register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName } = registerSchema.parse(req.body);

    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userId = uuidv4();
    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, is_active, is_verified)
       VALUES ($1, $2, $3, 'member', true, false)`,
      [userId, email, passwordHash]
    );

    // Create member profile
    const memberId = uuidv4();
    await pool.query(
      `INSERT INTO members (id, user_id, first_name, last_name, status, chapter_join_date)
       VALUES ($1, $2, $3, $4, 'prospect', CURRENT_DATE)`,
      [memberId, userId, firstName, lastName]
    );

    // Generate tokens
    const tokens = generateTokens({ userId, email, role: 'member', memberId });

    // Store refresh token hash
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [userId, refreshTokenHash]
    );

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: userId,
          email,
          role: 'member',
          member: {
            id: memberId,
            firstName,
            lastName,
            nickname: null,
            photoUrl: null,
          },
        },
        ...tokens,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    next(error);
  }
});

// Login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Get user with full member data
    const result = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.role, u.is_active,
              m.id as member_id, m.first_name, m.last_name, m.nickname,
              m.photo_url, m.status as member_status
       FROM users u
       LEFT JOIN members m ON m.user_id = u.id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ success: false, error: 'Account is disabled' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ success: false, error: 'Please use social login' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      memberId: user.member_id,
    });

    // Store refresh token
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [user.id, refreshTokenHash]
    );

    logger.info(`User logged in: ${email}`);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          member: user.member_id
            ? {
                id: user.member_id,
                firstName: user.first_name,
                lastName: user.last_name,
                nickname: user.nickname,
                photoUrl: user.photo_url,
              }
            : null,
        },
        ...tokens,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required' });
    }

    // Verify token
    let decoded: { userId: string };
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as { userId: string };
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid refresh token' });
    }

    // Get user
    const result = await pool.query(
      `SELECT u.id, u.email, u.role, m.id as member_id
       FROM users u
       LEFT JOIN members m ON m.user_id = u.id
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const user = result.rows[0];

    // Generate new tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      memberId: user.member_id,
    });

    // Store new refresh token
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [user.id, refreshTokenHash]
    );

    res.json({ success: true, data: tokens });
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // Add token to blacklist in Redis (for remaining validity period)
      try {
        const decoded = jwt.decode(token) as { exp?: number };
        if (decoded?.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await redis.setEx(`blacklist:${token}`, ttl, '1');
          }
        }
      } catch {
        // Token already invalid, ignore
      }
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // Check blacklist
    const blacklisted = await redis.get(`blacklist:${token}`);
    if (blacklisted) {
      return res.status(401).json({ success: false, error: 'Token revoked' });
    }

    // Verify token
    let decoded: { userId: string; email: string; role: string; memberId?: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as typeof decoded;
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    // Get full user data
    const result = await pool.query(
      `SELECT u.id, u.email, u.role, u.is_active, u.is_verified,
              m.id as member_id, m.first_name, m.last_name, m.nickname,
              m.photo_url, m.status as member_status
       FROM users u
       LEFT JOIN members m ON m.user_id = u.id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.is_active,
        isVerified: user.is_verified,
        member: user.member_id
          ? {
              id: user.member_id,
              firstName: user.first_name,
              lastName: user.last_name,
              nickname: user.nickname,
              photoUrl: user.photo_url,
              status: user.member_status,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=oauth' }),
  async (req: Request, res: Response) => {
    const user = req.user as { id: string; email: string; role: string; member_id?: string };
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      memberId: user.member_id,
    });

    // Redirect to frontend with tokens
    res.redirect(
      `${process.env.APP_URL}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`
    );
  }
);

// Facebook OAuth routes
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));

router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: '/login?error=oauth' }),
  async (req: Request, res: Response) => {
    const user = req.user as { id: string; email: string; role: string; member_id?: string };
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      memberId: user.member_id,
    });

    res.redirect(
      `${process.env.APP_URL}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`
    );
  }
);

// Change password
router.post('/change-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Invalid password' });
    }

    // Get user
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Current password incorrect' });
    }

    // Update password
    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, decoded.userId]);

    // Revoke all refresh tokens
    await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1', [decoded.userId]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
