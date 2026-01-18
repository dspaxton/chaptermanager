import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../index';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

const createMeetingSchema = z.object({
  title: z.string().min(1),
  meetingType: z.enum(['chapter', 'officer', 'committee', 'special', 'annual']).default('chapter'),
  meetingDate: z.string(),
  startTime: z.string(),
  endTime: z.string().optional(),
  location: z.string().optional(),
  address: z.string().optional(),
  isVirtual: z.boolean().default(false),
  virtualLink: z.string().url().optional(),
  agenda: z.string().optional(),
});

const updateMeetingSchema = createMeetingSchema.partial();

// Get all meetings
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      startDate,
      endDate,
      meetingType,
      status,
      page = '1',
      limit = '20',
    } = req.query;

    let query = `
      SELECT m.*,
             creator.first_name as creator_first_name, creator.last_name as creator_last_name,
             COUNT(DISTINCT ma.id) FILTER (WHERE ma.attended = true) as attendee_count,
             CASE WHEN mins.id IS NOT NULL THEN true ELSE false END as has_minutes
      FROM meetings m
      LEFT JOIN users u ON u.id = m.created_by
      LEFT JOIN members creator ON creator.user_id = u.id
      LEFT JOIN meeting_attendees ma ON ma.meeting_id = m.id
      LEFT JOIN minutes mins ON mins.meeting_id = m.id AND mins.is_published = true
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND m.meeting_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND m.meeting_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    if (meetingType) {
      query += ` AND m.meeting_type = $${paramIndex++}`;
      params.push(meetingType);
    }

    if (status) {
      query += ` AND m.status = $${paramIndex++}`;
      params.push(status);
    }

    // Non-officers can only see chapter meetings
    if (!['admin', 'director', 'officer'].includes(req.user!.role)) {
      query += ` AND m.meeting_type = 'chapter'`;
    }

    query += ` GROUP BY m.id, creator.first_name, creator.last_name, mins.id`;

    // Count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM (SELECT m.id FROM meetings m WHERE 1=1 ${
        meetingType ? `AND m.meeting_type = '${meetingType}'` : ''
      }) as subquery`
    );
    const total = parseInt(countResult.rows[0].count);

    // Pagination
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    query += ` ORDER BY m.meeting_date DESC, m.start_time DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        title: row.title,
        meetingType: row.meeting_type,
        status: row.status,
        meetingDate: row.meeting_date,
        startTime: row.start_time,
        endTime: row.end_time,
        location: row.location,
        isVirtual: row.is_virtual,
        virtualLink: row.virtual_link,
        attendeeCount: parseInt(row.attendee_count),
        hasMinutes: row.has_minutes,
        createdBy: { firstName: row.creator_first_name, lastName: row.creator_last_name },
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

// Get upcoming meetings
router.get('/upcoming', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { limit = '5' } = req.query;

    let query = `
      SELECT id, title, meeting_type, meeting_date, start_time, location, is_virtual
      FROM meetings
      WHERE meeting_date >= CURRENT_DATE
        AND status = 'scheduled'
    `;

    if (!['admin', 'director', 'officer'].includes(req.user!.role)) {
      query += ` AND meeting_type = 'chapter'`;
    }

    query += ` ORDER BY meeting_date ASC, start_time ASC LIMIT $1`;

    const result = await pool.query(query, [limit]);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        title: row.title,
        meetingType: row.meeting_type,
        meetingDate: row.meeting_date,
        startTime: row.start_time,
        location: row.location,
        isVirtual: row.is_virtual,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Get single meeting
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT m.*,
              creator.first_name as creator_first_name, creator.last_name as creator_last_name
       FROM meetings m
       LEFT JOIN users u ON u.id = m.created_by
       LEFT JOIN members creator ON creator.user_id = u.id
       WHERE m.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    const meeting = result.rows[0];

    // Check access for officer meetings
    if (
      meeting.meeting_type === 'officer' &&
      !['admin', 'director', 'officer'].includes(req.user!.role)
    ) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Get attendees
    const attendees = await pool.query(
      `SELECT ma.*, m.first_name, m.last_name, m.nickname, m.photo_url
       FROM meeting_attendees ma
       JOIN members m ON m.id = ma.member_id
       WHERE ma.meeting_id = $1
       ORDER BY m.last_name, m.first_name`,
      [id]
    );

    // Get action items
    const actionItems = await pool.query(
      `SELECT ai.*,
              assigned.first_name as assigned_first_name, assigned.last_name as assigned_last_name
       FROM action_items ai
       LEFT JOIN members assigned ON assigned.id = ai.assigned_to
       WHERE ai.meeting_id = $1
       ORDER BY ai.priority, ai.due_date`,
      [id]
    );

    // Get motions
    const motions = await pool.query(
      `SELECT mo.*,
              proposer.first_name as proposer_first_name, proposer.last_name as proposer_last_name,
              seconder.first_name as seconder_first_name, seconder.last_name as seconder_last_name
       FROM motions mo
       LEFT JOIN members proposer ON proposer.id = mo.proposed_by
       LEFT JOIN members seconder ON seconder.id = mo.seconded_by
       WHERE mo.meeting_id = $1
       ORDER BY mo.created_at`,
      [id]
    );

    res.json({
      success: true,
      data: {
        id: meeting.id,
        title: meeting.title,
        meetingType: meeting.meeting_type,
        status: meeting.status,
        meetingDate: meeting.meeting_date,
        startTime: meeting.start_time,
        endTime: meeting.end_time,
        location: meeting.location,
        address: meeting.address,
        isVirtual: meeting.is_virtual,
        virtualLink: meeting.virtual_link,
        agenda: meeting.agenda,
        createdBy: {
          firstName: meeting.creator_first_name,
          lastName: meeting.creator_last_name,
        },
        attendees: attendees.rows.map(a => ({
          id: a.id,
          memberId: a.member_id,
          firstName: a.first_name,
          lastName: a.last_name,
          nickname: a.nickname,
          photoUrl: a.photo_url,
          attended: a.attended,
          arrivedAt: a.arrived_at,
        })),
        actionItems: actionItems.rows.map(ai => ({
          id: ai.id,
          title: ai.title,
          description: ai.description,
          assignedTo: ai.assigned_first_name
            ? { firstName: ai.assigned_first_name, lastName: ai.assigned_last_name }
            : null,
          status: ai.status,
          dueDate: ai.due_date,
          priority: ai.priority,
        })),
        motions: motions.rows.map(mo => ({
          id: mo.id,
          motionText: mo.motion_text,
          proposedBy: mo.proposer_first_name
            ? { firstName: mo.proposer_first_name, lastName: mo.proposer_last_name }
            : null,
          secondedBy: mo.seconder_first_name
            ? { firstName: mo.seconder_first_name, lastName: mo.seconder_last_name }
            : null,
          votesFor: mo.votes_for,
          votesAgainst: mo.votes_against,
          votesAbstain: mo.votes_abstain,
          passed: mo.passed,
        })),
        createdAt: meeting.created_at,
        updatedAt: meeting.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create meeting
router.post(
  '/',
  authenticate,
  requireRole('admin', 'director', 'officer'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const meeting = createMeetingSchema.parse(req.body);

      const meetingId = uuidv4();

      await pool.query(
        `INSERT INTO meetings (
          id, title, meeting_type, status,
          meeting_date, start_time, end_time,
          location, address, is_virtual, virtual_link,
          agenda, created_by
        ) VALUES ($1, $2, $3, 'scheduled', $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          meetingId,
          meeting.title,
          meeting.meetingType,
          meeting.meetingDate,
          meeting.startTime,
          meeting.endTime,
          meeting.location,
          meeting.address,
          meeting.isVirtual,
          meeting.virtualLink,
          meeting.agenda,
          req.user!.userId,
        ]
      );

      logger.info(`Meeting created: ${meeting.title} by ${req.user!.userId}`);

      res.status(201).json({ success: true, data: { id: meetingId } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.errors });
      }
      next(error);
    }
  }
);

// Update meeting
router.put(
  '/:id',
  authenticate,
  requireRole('admin', 'director', 'officer'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updates = updateMeetingSchema.parse(req.body);

      const fields: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      const fieldMap: Record<string, string> = {
        title: 'title',
        meetingType: 'meeting_type',
        meetingDate: 'meeting_date',
        startTime: 'start_time',
        endTime: 'end_time',
        location: 'location',
        address: 'address',
        isVirtual: 'is_virtual',
        virtualLink: 'virtual_link',
        agenda: 'agenda',
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
        `UPDATE meetings SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );

      res.json({ success: true, message: 'Meeting updated successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.errors });
      }
      next(error);
    }
  }
);

// Update meeting status
router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin', 'director', 'officer'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }

      await pool.query('UPDATE meetings SET status = $1 WHERE id = $2', [status, id]);

      res.json({ success: true, message: 'Status updated successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Record attendance
router.post(
  '/:id/attendance',
  authenticate,
  requireRole('admin', 'director', 'officer'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { memberIds } = req.body;

      if (!Array.isArray(memberIds)) {
        return res.status(400).json({ success: false, error: 'memberIds must be an array' });
      }

      for (const memberId of memberIds) {
        await pool.query(
          `INSERT INTO meeting_attendees (id, meeting_id, member_id, attended, arrived_at)
           VALUES ($1, $2, $3, true, CURRENT_TIME)
           ON CONFLICT (meeting_id, member_id)
           DO UPDATE SET attended = true, arrived_at = CURRENT_TIME`,
          [uuidv4(), id, memberId]
        );
      }

      logger.info(`Attendance recorded for meeting ${id}: ${memberIds.length} members`);

      res.json({ success: true, message: 'Attendance recorded successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Record a motion
router.post(
  '/:id/motions',
  authenticate,
  requireRole('admin', 'director', 'officer'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { motionText, proposedBy, secondedBy, votesFor, votesAgainst, votesAbstain } = req.body;

      if (!motionText) {
        return res.status(400).json({ success: false, error: 'Motion text required' });
      }

      const passed = votesFor > votesAgainst;

      const motionId = uuidv4();
      await pool.query(
        `INSERT INTO motions (id, meeting_id, motion_text, proposed_by, seconded_by,
                              votes_for, votes_against, votes_abstain, passed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [motionId, id, motionText, proposedBy, secondedBy, votesFor || 0, votesAgainst || 0, votesAbstain || 0, passed]
      );

      res.status(201).json({ success: true, data: { id: motionId, passed } });
    } catch (error) {
      next(error);
    }
  }
);

// Create action item
router.post(
  '/:id/action-items',
  authenticate,
  requireRole('admin', 'director', 'officer'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { title, description, assignedTo, dueDate, priority = 2 } = req.body;

      if (!title) {
        return res.status(400).json({ success: false, error: 'Title required' });
      }

      const actionItemId = uuidv4();
      await pool.query(
        `INSERT INTO action_items (id, meeting_id, title, description, assigned_to, assigned_by, due_date, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [actionItemId, id, title, description, assignedTo, req.user!.memberId, dueDate, priority]
      );

      res.status(201).json({ success: true, data: { id: actionItemId } });
    } catch (error) {
      next(error);
    }
  }
);

// Update action item status
router.patch(
  '/:meetingId/action-items/:actionItemId',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { actionItemId } = req.params;
      const { status, notes } = req.body;

      // Check if user is assigned to this action item or is an officer
      const result = await pool.query(
        'SELECT assigned_to FROM action_items WHERE id = $1',
        [actionItemId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Action item not found' });
      }

      const isAssignee = result.rows[0].assigned_to === req.user!.memberId;
      const isOfficer = ['admin', 'director', 'officer'].includes(req.user!.role);

      if (!isAssignee && !isOfficer) {
        return res.status(403).json({ success: false, error: 'Cannot update this action item' });
      }

      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (status) {
        const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ success: false, error: 'Invalid status' });
        }
        updates.push(`status = $${paramIndex++}`);
        values.push(status);

        if (status === 'completed') {
          updates.push(`completed_at = NOW()`);
        }
      }

      if (notes !== undefined) {
        updates.push(`notes = $${paramIndex++}`);
        values.push(notes);
      }

      values.push(actionItemId);

      await pool.query(
        `UPDATE action_items SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );

      res.json({ success: true, message: 'Action item updated' });
    } catch (error) {
      next(error);
    }
  }
);

export { router as meetingRouter };
