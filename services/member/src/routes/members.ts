import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../index';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const updateMemberSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  nickname: z.string().optional(),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  hogNumber: z.string().optional(),
  nationalHogExpiry: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  bio: z.string().optional(),
  isPublicDirectory: z.boolean().optional(),
});

// Get all members (directory)
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search, status, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = `
      SELECT m.id, m.first_name, m.last_name, m.nickname, m.photo_url,
             m.status, m.total_mileage, m.total_rides,
             mp.position_title as current_position
      FROM members m
      LEFT JOIN member_positions mp ON mp.member_id = m.id AND mp.is_current = true
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    // Filter by public directory unless admin/officer
    if (!['admin', 'director', 'officer'].includes(req.user!.role)) {
      query += ` AND m.is_public_directory = true`;
    }

    if (status) {
      query += ` AND m.status = $${paramIndex++}`;
      params.push(status);
    }

    if (search) {
      query += ` AND (m.first_name ILIKE $${paramIndex} OR m.last_name ILIKE $${paramIndex} OR m.nickname ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM (${query}) as subquery`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    query += ` ORDER BY m.last_name, m.first_name LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        nickname: row.nickname,
        photoUrl: row.photo_url,
        status: row.status,
        totalMileage: row.total_mileage,
        totalRides: row.total_rides,
        currentPosition: row.current_position,
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get single member
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT m.*, u.email, u.role
       FROM members m
       JOIN users u ON u.id = m.user_id
       WHERE m.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    const member = result.rows[0];

    // Check if user can view full profile
    const canViewFull =
      req.user!.memberId === id ||
      ['admin', 'director', 'officer'].includes(req.user!.role) ||
      member.is_public_directory;

    if (!canViewFull) {
      return res.status(403).json({ success: false, error: 'Cannot view this member' });
    }

    // Get positions
    const positions = await pool.query(
      `SELECT position_title, start_date, end_date, is_current
       FROM member_positions
       WHERE member_id = $1
       ORDER BY start_date DESC`,
      [id]
    );

    // Get bikes
    const bikes = await pool.query(
      `SELECT id, year, make, model, nickname, color, is_primary, photo_url
       FROM member_bikes
       WHERE member_id = $1
       ORDER BY is_primary DESC, year DESC`,
      [id]
    );

    // Determine what fields to return based on access level
    const isOwner = req.user!.memberId === id;
    const isOfficer = ['admin', 'director', 'officer'].includes(req.user!.role);

    const responseData: Record<string, unknown> = {
      id: member.id,
      firstName: member.first_name,
      lastName: member.last_name,
      nickname: member.nickname,
      photoUrl: member.photo_url,
      bio: member.bio,
      status: member.status,
      chapterJoinDate: member.chapter_join_date,
      totalMileage: member.total_mileage,
      totalRides: member.total_rides,
      totalMeetings: member.total_meetings,
      positions: positions.rows,
      bikes: bikes.rows,
    };

    // Include sensitive info only for owner or officers
    if (isOwner || isOfficer) {
      responseData.email = member.email;
      responseData.phone = member.phone;
      responseData.addressLine1 = member.address_line1;
      responseData.addressLine2 = member.address_line2;
      responseData.city = member.city;
      responseData.state = member.state;
      responseData.zipCode = member.zip_code;
      responseData.hogNumber = member.hog_number;
      responseData.nationalHogExpiry = member.national_hog_expiry;
      responseData.emergencyContactName = member.emergency_contact_name;
      responseData.emergencyContactPhone = member.emergency_contact_phone;
      responseData.emergencyContactRelation = member.emergency_contact_relation;
      responseData.isPublicDirectory = member.is_public_directory;
    }

    res.json({ success: true, data: responseData });
  } catch (error) {
    next(error);
  }
});

// Update member profile
router.put('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Check authorization - only self or admin can update
    const isOwner = req.user!.memberId === id;
    const isAdmin = ['admin', 'director'].includes(req.user!.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Cannot update this member' });
    }

    const updates = updateMemberSchema.parse(req.body);

    // Build update query dynamically
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      firstName: 'first_name',
      lastName: 'last_name',
      nickname: 'nickname',
      phone: 'phone',
      addressLine1: 'address_line1',
      addressLine2: 'address_line2',
      city: 'city',
      state: 'state',
      zipCode: 'zip_code',
      hogNumber: 'hog_number',
      nationalHogExpiry: 'national_hog_expiry',
      emergencyContactName: 'emergency_contact_name',
      emergencyContactPhone: 'emergency_contact_phone',
      emergencyContactRelation: 'emergency_contact_relation',
      bio: 'bio',
      isPublicDirectory: 'is_public_directory',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (key in updates) {
        fields.push(`${dbField} = $${paramIndex++}`);
        values.push(updates[key as keyof typeof updates]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    values.push(id);

    await pool.query(
      `UPDATE members SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    logger.info(`Member ${id} updated by ${req.user!.userId}`);

    res.json({ success: true, message: 'Member updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    next(error);
  }
});

// Update member status (admin only)
router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin', 'director'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['active', 'inactive', 'prospect', 'suspended', 'honorary'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }

      await pool.query('UPDATE members SET status = $1 WHERE id = $2', [status, id]);

      logger.info(`Member ${id} status changed to ${status} by ${req.user!.userId}`);

      res.json({ success: true, message: 'Status updated successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Add position to member (admin only)
router.post(
  '/:id/positions',
  authenticate,
  requireRole('admin', 'director'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { positionTitle, startDate } = req.body;

      if (!positionTitle || !startDate) {
        return res.status(400).json({ success: false, error: 'Position title and start date required' });
      }

      // End any current positions with the same title
      await pool.query(
        `UPDATE member_positions
         SET is_current = false, end_date = $1
         WHERE member_id = $2 AND position_title = $3 AND is_current = true`,
        [startDate, id, positionTitle]
      );

      // Add new position
      const positionId = uuidv4();
      await pool.query(
        `INSERT INTO member_positions (id, member_id, position_title, start_date, is_current)
         VALUES ($1, $2, $3, $4, true)`,
        [positionId, id, positionTitle, startDate]
      );

      logger.info(`Position ${positionTitle} added to member ${id}`);

      res.status(201).json({ success: true, data: { id: positionId } });
    } catch (error) {
      next(error);
    }
  }
);

// Get member statistics
router.get('/stats/overview', authenticate, requireRole('admin', 'director', 'officer'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_members,
        COUNT(*) FILTER (WHERE status = 'prospect') as prospects,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive_members,
        SUM(total_mileage) as total_chapter_mileage,
        AVG(total_rides) as avg_rides_per_member
      FROM members
    `);

    const recentJoins = await pool.query(`
      SELECT COUNT(*) as count
      FROM members
      WHERE chapter_join_date >= CURRENT_DATE - INTERVAL '30 days'
    `);

    res.json({
      success: true,
      data: {
        activeMembers: parseInt(stats.rows[0].active_members),
        prospects: parseInt(stats.rows[0].prospects),
        inactiveMembers: parseInt(stats.rows[0].inactive_members),
        totalChapterMileage: parseInt(stats.rows[0].total_chapter_mileage) || 0,
        avgRidesPerMember: parseFloat(stats.rows[0].avg_rides_per_member) || 0,
        newMembersLast30Days: parseInt(recentJoins.rows[0].count),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Log mileage
router.post('/:id/mileage', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Only self can log mileage
    if (req.user!.memberId !== id) {
      return res.status(403).json({ success: false, error: 'Can only log your own mileage' });
    }

    const { date, miles, description, rideId } = req.body;

    if (!date || !miles || miles <= 0) {
      return res.status(400).json({ success: false, error: 'Date and valid miles required' });
    }

    const logId = uuidv4();
    await pool.query(
      `INSERT INTO mileage_logs (id, member_id, ride_id, date, miles, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [logId, id, rideId || null, date, miles, description]
    );

    // Update total mileage
    await pool.query(
      'UPDATE members SET total_mileage = total_mileage + $1 WHERE id = $2',
      [miles, id]
    );

    res.status(201).json({ success: true, data: { id: logId } });
  } catch (error) {
    next(error);
  }
});

export { router as memberRouter };
