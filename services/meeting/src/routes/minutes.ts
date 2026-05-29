import { Router, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../index';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

// Type for AI summarize response
interface AISummarizeResponse {
  success: boolean;
  data: {
    summary: string;
    actionItems?: Array<{ title: string; description: string }>;
    keyDecisions?: string[];
  };
}

const router = Router();

// Get all published minutes (for browsing) - MUST be before /:meetingId routes
router.get('/all/minutes', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = `
      SELECT m.id, m.meeting_id, m.summary, m.ai_summary, m.approved_at, m.created_at,
             mtg.title as meeting_title, mtg.meeting_date, mtg.meeting_type
      FROM minutes m
      JOIN meetings mtg ON mtg.id = m.meeting_id
      WHERE m.is_published = true
    `;

    // Non-officers can only see chapter meeting minutes
    if (!['admin', 'director', 'officer'].includes(req.user!.role)) {
      query += ` AND mtg.meeting_type = 'chapter'`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM (${query}) as subquery`
    );
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY mtg.meeting_date DESC LIMIT $1 OFFSET $2`;

    const result = await pool.query(query, [limit, offset]);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        meetingId: row.meeting_id,
        meetingTitle: row.meeting_title,
        meetingDate: row.meeting_date,
        meetingType: row.meeting_type,
        summary: row.summary,
        aiSummary: row.ai_summary,
        approvedAt: row.approved_at,
        createdAt: row.created_at,
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

// Get minutes for a meeting
router.get('/:meetingId/minutes', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { meetingId } = req.params;

    // Check meeting access
    const meetingResult = await pool.query(
      'SELECT meeting_type FROM meetings WHERE id = $1',
      [meetingId]
    );

    if (meetingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    const meeting = meetingResult.rows[0];

    // Non-officers can only see chapter meeting minutes
    if (
      meeting.meeting_type === 'officer' &&
      !['admin', 'director', 'officer'].includes(req.user!.role)
    ) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT m.*,
              recorder.first_name as recorder_first_name, recorder.last_name as recorder_last_name,
              approver.first_name as approver_first_name, approver.last_name as approver_last_name
       FROM minutes m
       LEFT JOIN members recorder ON recorder.id = m.recorded_by
       LEFT JOIN members approver ON approver.id = m.approved_by
       WHERE m.meeting_id = $1
       ORDER BY m.version DESC
       LIMIT 1`,
      [meetingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Minutes not found' });
    }

    const minutes = result.rows[0];

    // Non-officers can only see published minutes
    if (
      !minutes.is_published &&
      !['admin', 'director', 'officer'].includes(req.user!.role)
    ) {
      return res.status(404).json({ success: false, error: 'Minutes not published yet' });
    }

    res.json({
      success: true,
      data: {
        id: minutes.id,
        meetingId: minutes.meeting_id,
        content: minutes.content,
        summary: minutes.summary,
        aiSummary: minutes.ai_summary,
        recordedBy: minutes.recorder_first_name
          ? { firstName: minutes.recorder_first_name, lastName: minutes.recorder_last_name }
          : null,
        approvedBy: minutes.approver_first_name
          ? { firstName: minutes.approver_first_name, lastName: minutes.approver_last_name }
          : null,
        approvedAt: minutes.approved_at,
        version: minutes.version,
        isPublished: minutes.is_published,
        createdAt: minutes.created_at,
        updatedAt: minutes.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create or update minutes
router.post(
  '/:meetingId/minutes',
  authenticate,
  requireRole('admin', 'director', 'officer'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { meetingId } = req.params;
      const { content, summary } = req.body;

      if (!content) {
        return res.status(400).json({ success: false, error: 'Content required' });
      }

      // Check if minutes exist
      const existing = await pool.query(
        'SELECT id, version FROM minutes WHERE meeting_id = $1 ORDER BY version DESC LIMIT 1',
        [meetingId]
      );

      let minutesId: string;
      let version: number;

      if (existing.rows.length > 0) {
        // Create new version
        version = existing.rows[0].version + 1;
        minutesId = uuidv4();

        await pool.query(
          `INSERT INTO minutes (id, meeting_id, content, summary, recorded_by, version, is_published)
           VALUES ($1, $2, $3, $4, $5, $6, false)`,
          [minutesId, meetingId, content, summary, req.user!.memberId, version]
        );
      } else {
        // Create first version
        minutesId = uuidv4();
        version = 1;

        await pool.query(
          `INSERT INTO minutes (id, meeting_id, content, summary, recorded_by, version, is_published)
           VALUES ($1, $2, $3, $4, $5, 1, false)`,
          [minutesId, meetingId, content, summary, req.user!.memberId]
        );
      }

      logger.info(`Minutes created/updated for meeting ${meetingId}, version ${version}`);

      res.status(201).json({
        success: true,
        data: { id: minutesId, version },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Request AI summary (calls AI service)
router.post(
  '/:meetingId/minutes/summarize',
  authenticate,
  requireRole('admin', 'director', 'officer'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { meetingId } = req.params;

      // Get current minutes
      const result = await pool.query(
        'SELECT id, content FROM minutes WHERE meeting_id = $1 ORDER BY version DESC LIMIT 1',
        [meetingId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Minutes not found' });
      }

      const minutes = result.rows[0];

      // Call AI service
      try {
        const aiResponse = await fetch('http://ai-service:4005/api/ai/summarize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: req.headers.authorization || '',
          },
          body: JSON.stringify({
            content: minutes.content,
            type: 'minutes',
          }),
        });

        if (!aiResponse.ok) {
          throw new Error('AI service error');
        }

        const aiResult = await aiResponse.json() as AISummarizeResponse;

        // Update minutes with AI summary
        await pool.query(
          'UPDATE minutes SET ai_summary = $1 WHERE id = $2',
          [aiResult.data.summary, minutes.id]
        );

        // Create action items from AI extraction
        if (aiResult.data.actionItems && aiResult.data.actionItems.length > 0) {
          for (const item of aiResult.data.actionItems) {
            await pool.query(
              `INSERT INTO action_items (id, meeting_id, minutes_id, title, description, status)
               VALUES ($1, $2, $3, $4, $5, 'pending')`,
              [uuidv4(), meetingId, minutes.id, item.title, item.description]
            );
          }
        }

        res.json({
          success: true,
          data: {
            summary: aiResult.data.summary,
            actionItems: aiResult.data.actionItems,
            keyDecisions: aiResult.data.keyDecisions,
          },
        });
      } catch {
        // AI service unavailable - return without AI summary
        res.status(503).json({
          success: false,
          error: 'AI service unavailable. Please try again later.',
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

// Approve and publish minutes
router.post(
  '/:meetingId/minutes/approve',
  authenticate,
  requireRole('admin', 'director'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { meetingId } = req.params;

      const result = await pool.query(
        'SELECT id FROM minutes WHERE meeting_id = $1 ORDER BY version DESC LIMIT 1',
        [meetingId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Minutes not found' });
      }

      await pool.query(
        `UPDATE minutes
         SET is_published = true, approved_by = $1, approved_at = NOW()
         WHERE id = $2`,
        [req.user!.memberId, result.rows[0].id]
      );

      // Update meeting status to completed
      await pool.query(
        `UPDATE meetings SET status = 'completed' WHERE id = $1`,
        [meetingId]
      );

      logger.info(`Minutes approved for meeting ${meetingId}`);

      res.json({ success: true, message: 'Minutes approved and published' });
    } catch (error) {
      next(error);
    }
  }
);

// Get minutes history (all versions)
router.get(
  '/:meetingId/minutes/history',
  authenticate,
  requireRole('admin', 'director', 'officer'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { meetingId } = req.params;

      const result = await pool.query(
        `SELECT m.id, m.version, m.is_published, m.created_at,
                recorder.first_name as recorder_first_name, recorder.last_name as recorder_last_name
         FROM minutes m
         LEFT JOIN members recorder ON recorder.id = m.recorded_by
         WHERE m.meeting_id = $1
         ORDER BY m.version DESC`,
        [meetingId]
      );

      res.json({
        success: true,
        data: result.rows.map(row => ({
          id: row.id,
          version: row.version,
          isPublished: row.is_published,
          recordedBy: row.recorder_first_name
            ? { firstName: row.recorder_first_name, lastName: row.recorder_last_name }
            : null,
          createdAt: row.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as minutesRouter };
