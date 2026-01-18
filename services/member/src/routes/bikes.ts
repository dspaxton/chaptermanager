import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

const bikeSchema = z.object({
  year: z.number().min(1900).max(new Date().getFullYear() + 1).optional(),
  make: z.string().default('Harley-Davidson'),
  model: z.string().optional(),
  nickname: z.string().optional(),
  color: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

// Get member's bikes
router.get('/:memberId/bikes', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { memberId } = req.params;

    const result = await pool.query(
      `SELECT id, year, make, model, nickname, color, is_primary, photo_url, created_at
       FROM member_bikes
       WHERE member_id = $1
       ORDER BY is_primary DESC, year DESC`,
      [memberId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        year: row.year,
        make: row.make,
        model: row.model,
        nickname: row.nickname,
        color: row.color,
        isPrimary: row.is_primary,
        photoUrl: row.photo_url,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Add a bike
router.post('/:memberId/bikes', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { memberId } = req.params;

    // Only self can add bikes
    if (req.user!.memberId !== memberId) {
      return res.status(403).json({ success: false, error: 'Can only manage your own bikes' });
    }

    const bike = bikeSchema.parse(req.body);

    // If this is primary, unset other primary bikes
    if (bike.isPrimary) {
      await pool.query(
        'UPDATE member_bikes SET is_primary = false WHERE member_id = $1',
        [memberId]
      );
    }

    const bikeId = uuidv4();
    await pool.query(
      `INSERT INTO member_bikes (id, member_id, year, make, model, nickname, color, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [bikeId, memberId, bike.year, bike.make, bike.model, bike.nickname, bike.color, bike.isPrimary]
    );

    logger.info(`Bike added for member ${memberId}`);

    res.status(201).json({ success: true, data: { id: bikeId } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    next(error);
  }
});

// Update a bike
router.put('/:memberId/bikes/:bikeId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { memberId, bikeId } = req.params;

    if (req.user!.memberId !== memberId) {
      return res.status(403).json({ success: false, error: 'Can only manage your own bikes' });
    }

    const bike = bikeSchema.parse(req.body);

    // If this is primary, unset other primary bikes
    if (bike.isPrimary) {
      await pool.query(
        'UPDATE member_bikes SET is_primary = false WHERE member_id = $1 AND id != $2',
        [memberId, bikeId]
      );
    }

    await pool.query(
      `UPDATE member_bikes
       SET year = $1, make = $2, model = $3, nickname = $4, color = $5, is_primary = $6
       WHERE id = $7 AND member_id = $8`,
      [bike.year, bike.make, bike.model, bike.nickname, bike.color, bike.isPrimary, bikeId, memberId]
    );

    res.json({ success: true, message: 'Bike updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    next(error);
  }
});

// Delete a bike
router.delete('/:memberId/bikes/:bikeId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { memberId, bikeId } = req.params;

    if (req.user!.memberId !== memberId) {
      return res.status(403).json({ success: false, error: 'Can only manage your own bikes' });
    }

    await pool.query('DELETE FROM member_bikes WHERE id = $1 AND member_id = $2', [bikeId, memberId]);

    logger.info(`Bike ${bikeId} deleted for member ${memberId}`);

    res.json({ success: true, message: 'Bike deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export { router as bikeRouter };
