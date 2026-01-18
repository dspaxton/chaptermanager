import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { pool } from '../index';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const createRideSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  rideType: z.enum(['chapter_ride', 'overnight', 'multi_day', 'dealer_event', 'charity', 'rally', 'other']).default('chapter_ride'),
  startDate: z.string(),
  startTime: z.string().optional(),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
  meetupLocation: z.string().optional(),
  meetupAddress: z.string().optional(),
  destination: z.string().optional(),
  destinationAddress: z.string().optional(),
  estimatedDistance: z.number().optional(),
  estimatedDuration: z.number().optional(),
  difficultyLevel: z.number().min(1).max(5).default(1),
  routeDescription: z.string().optional(),
  routeMapUrl: z.string().url().optional(),
  // RSVP is off by default - only enabled for special events
  rsvpRequired: z.boolean().default(false),
  rsvpDeadline: z.string().optional(),
  maxParticipants: z.number().optional(),
  leadRoadCaptainId: z.string().uuid().optional(),
  sweepRoadCaptainId: z.string().uuid().optional(),
});

const updateRideSchema = createRideSchema.partial();

// Get all rides (calendar view)
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      startDate,
      endDate,
      status,
      rideType,
      page = '1',
      limit = '20',
    } = req.query;

    let query = `
      SELECT r.*,
             lrc.first_name as lead_rc_first_name, lrc.last_name as lead_rc_last_name,
             src.first_name as sweep_rc_first_name, src.last_name as sweep_rc_last_name,
             COUNT(DISTINCT rp.id) FILTER (WHERE rp.attended = true OR (rp.rsvp_status = 'going' AND r.status != 'completed')) as participant_count
      FROM rides r
      LEFT JOIN members lrc ON lrc.id = r.lead_road_captain_id
      LEFT JOIN members src ON src.id = r.sweep_road_captain_id
      LEFT JOIN ride_participants rp ON rp.ride_id = r.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND r.start_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND r.start_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    if (status) {
      query += ` AND r.status = $${paramIndex++}`;
      params.push(status);
    }

    if (rideType) {
      query += ` AND r.ride_type = $${paramIndex++}`;
      params.push(rideType);
    }

    // Only show published rides for non-officers
    if (!['admin', 'director', 'officer', 'road_captain'].includes(req.user!.role)) {
      query += ` AND r.status != 'draft'`;
    }

    query += ` GROUP BY r.id, lrc.first_name, lrc.last_name, src.first_name, src.last_name`;

    // Get total count
    const countQuery = `SELECT COUNT(DISTINCT r.id) FROM (${query}) as subquery`;
    const countResult = await pool.query(countQuery.replace('SELECT COUNT(DISTINCT r.id) FROM', 'SELECT COUNT(*) FROM'), params);
    const total = parseInt(countResult.rows[0].count);

    // Add ordering and pagination
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    query += ` ORDER BY r.start_date ASC, r.start_time ASC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        rideType: row.ride_type,
        status: row.status,
        startDate: row.start_date,
        startTime: row.start_time,
        endDate: row.end_date,
        meetupLocation: row.meetup_location,
        destination: row.destination,
        estimatedDistance: row.estimated_distance,
        difficultyLevel: row.difficulty_level,
        rsvpRequired: row.rsvp_required,
        maxParticipants: row.max_participants,
        participantCount: parseInt(row.participant_count),
        leadRoadCaptain: row.lead_rc_first_name
          ? { firstName: row.lead_rc_first_name, lastName: row.lead_rc_last_name }
          : null,
        sweepRoadCaptain: row.sweep_rc_first_name
          ? { firstName: row.sweep_rc_first_name, lastName: row.sweep_rc_last_name }
          : null,
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

// Get upcoming rides
router.get('/upcoming', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { limit = '5' } = req.query;

    const result = await pool.query(
      `SELECT r.id, r.title, r.start_date, r.start_time, r.meetup_location,
              r.destination, r.ride_type, r.rsvp_required
       FROM rides r
       WHERE r.start_date >= CURRENT_DATE
         AND r.status = 'published'
       ORDER BY r.start_date ASC, r.start_time ASC
       LIMIT $1`,
      [limit]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        title: row.title,
        startDate: row.start_date,
        startTime: row.start_time,
        meetupLocation: row.meetup_location,
        destination: row.destination,
        rideType: row.ride_type,
        rsvpRequired: row.rsvp_required,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Get single ride
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT r.*,
              lrc.id as lead_rc_id, lrc.first_name as lead_rc_first_name, lrc.last_name as lead_rc_last_name,
              src.id as sweep_rc_id, src.first_name as sweep_rc_first_name, src.last_name as sweep_rc_last_name,
              creator.first_name as creator_first_name, creator.last_name as creator_last_name
       FROM rides r
       LEFT JOIN members lrc ON lrc.id = r.lead_road_captain_id
       LEFT JOIN members src ON src.id = r.sweep_road_captain_id
       LEFT JOIN users u ON u.id = r.created_by
       LEFT JOIN members creator ON creator.user_id = u.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ride not found' });
    }

    const ride = result.rows[0];

    // Get waypoints
    const waypoints = await pool.query(
      `SELECT id, sequence_order, name, address, lat, lng, stop_type, estimated_arrival_time, notes
       FROM ride_waypoints
       WHERE ride_id = $1
       ORDER BY sequence_order`,
      [id]
    );

    // Get participants
    const participants = await pool.query(
      `SELECT rp.*, m.first_name, m.last_name, m.nickname, m.photo_url
       FROM ride_participants rp
       JOIN members m ON m.id = rp.member_id
       WHERE rp.ride_id = $1
       ORDER BY rp.created_at`,
      [id]
    );

    // Check if current user is participating
    const userParticipation = participants.rows.find(
      p => p.member_id === req.user!.memberId
    );

    res.json({
      success: true,
      data: {
        id: ride.id,
        title: ride.title,
        description: ride.description,
        rideType: ride.ride_type,
        status: ride.status,
        startDate: ride.start_date,
        startTime: ride.start_time,
        endDate: ride.end_date,
        endTime: ride.end_time,
        meetupLocation: ride.meetup_location,
        meetupAddress: ride.meetup_address,
        meetupLat: ride.meetup_lat,
        meetupLng: ride.meetup_lng,
        destination: ride.destination,
        destinationAddress: ride.destination_address,
        destinationLat: ride.destination_lat,
        destinationLng: ride.destination_lng,
        estimatedDistance: ride.estimated_distance,
        estimatedDuration: ride.estimated_duration,
        difficultyLevel: ride.difficulty_level,
        routeDescription: ride.route_description,
        routeMapUrl: ride.route_map_url,
        rsvpRequired: ride.rsvp_required,
        rsvpDeadline: ride.rsvp_deadline,
        maxParticipants: ride.max_participants,
        actualDistance: ride.actual_distance,
        actualDuration: ride.actual_duration,
        weatherConditions: ride.weather_conditions,
        rideReport: ride.ride_report,
        leadRoadCaptain: ride.lead_rc_id
          ? { id: ride.lead_rc_id, firstName: ride.lead_rc_first_name, lastName: ride.lead_rc_last_name }
          : null,
        sweepRoadCaptain: ride.sweep_rc_id
          ? { id: ride.sweep_rc_id, firstName: ride.sweep_rc_first_name, lastName: ride.sweep_rc_last_name }
          : null,
        createdBy: { firstName: ride.creator_first_name, lastName: ride.creator_last_name },
        waypoints: waypoints.rows,
        participants: participants.rows.map(p => ({
          id: p.id,
          memberId: p.member_id,
          firstName: p.first_name,
          lastName: p.last_name,
          nickname: p.nickname,
          photoUrl: p.photo_url,
          rsvpStatus: p.rsvp_status,
          guests: p.guests,
          attended: p.attended,
          mileageLogged: p.mileage_logged,
          isRoadCaptain: p.is_road_captain,
        })),
        userParticipation: userParticipation
          ? {
              rsvpStatus: userParticipation.rsvp_status,
              guests: userParticipation.guests,
              attended: userParticipation.attended,
            }
          : null,
        createdAt: ride.created_at,
        updatedAt: ride.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create ride (officers and road captains only)
router.post(
  '/',
  authenticate,
  requireRole('admin', 'director', 'officer', 'road_captain'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const ride = createRideSchema.parse(req.body);

      const rideId = uuidv4();

      await pool.query(
        `INSERT INTO rides (
          id, title, description, ride_type, status,
          start_date, start_time, end_date, end_time,
          meetup_location, meetup_address,
          destination, destination_address,
          estimated_distance, estimated_duration, difficulty_level,
          route_description, route_map_url,
          rsvp_required, rsvp_deadline, max_participants,
          lead_road_captain_id, sweep_road_captain_id,
          created_by
        ) VALUES (
          $1, $2, $3, $4, 'draft',
          $5, $6, $7, $8,
          $9, $10,
          $11, $12,
          $13, $14, $15,
          $16, $17,
          $18, $19, $20,
          $21, $22,
          $23
        )`,
        [
          rideId, ride.title, ride.description, ride.rideType,
          ride.startDate, ride.startTime, ride.endDate, ride.endTime,
          ride.meetupLocation, ride.meetupAddress,
          ride.destination, ride.destinationAddress,
          ride.estimatedDistance, ride.estimatedDuration, ride.difficultyLevel,
          ride.routeDescription, ride.routeMapUrl,
          ride.rsvpRequired, ride.rsvpDeadline, ride.maxParticipants,
          ride.leadRoadCaptainId, ride.sweepRoadCaptainId,
          req.user!.userId,
        ]
      );

      logger.info(`Ride created: ${ride.title} by ${req.user!.userId}`);

      res.status(201).json({ success: true, data: { id: rideId } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.errors });
      }
      next(error);
    }
  }
);

// Update ride
router.put(
  '/:id',
  authenticate,
  requireRole('admin', 'director', 'officer', 'road_captain'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updates = updateRideSchema.parse(req.body);

      // Build dynamic update query
      const fields: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      const fieldMap: Record<string, string> = {
        title: 'title',
        description: 'description',
        rideType: 'ride_type',
        startDate: 'start_date',
        startTime: 'start_time',
        endDate: 'end_date',
        endTime: 'end_time',
        meetupLocation: 'meetup_location',
        meetupAddress: 'meetup_address',
        destination: 'destination',
        destinationAddress: 'destination_address',
        estimatedDistance: 'estimated_distance',
        estimatedDuration: 'estimated_duration',
        difficultyLevel: 'difficulty_level',
        routeDescription: 'route_description',
        routeMapUrl: 'route_map_url',
        rsvpRequired: 'rsvp_required',
        rsvpDeadline: 'rsvp_deadline',
        maxParticipants: 'max_participants',
        leadRoadCaptainId: 'lead_road_captain_id',
        sweepRoadCaptainId: 'sweep_road_captain_id',
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
        `UPDATE rides SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );

      res.json({ success: true, message: 'Ride updated successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.errors });
      }
      next(error);
    }
  }
);

// Update ride status
router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin', 'director', 'officer', 'road_captain'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['draft', 'published', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }

      await pool.query('UPDATE rides SET status = $1 WHERE id = $2', [status, id]);

      logger.info(`Ride ${id} status changed to ${status}`);

      res.json({ success: true, message: 'Status updated successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// RSVP to a ride (only if ride requires RSVP)
router.post('/:id/rsvp', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, guests = 0 } = req.body;
    const memberId = req.user!.memberId;

    if (!memberId) {
      return res.status(400).json({ success: false, error: 'Member profile required' });
    }

    // Check if ride exists and requires RSVP
    const rideResult = await pool.query(
      'SELECT rsvp_required, rsvp_deadline, max_participants, status FROM rides WHERE id = $1',
      [id]
    );

    if (rideResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ride not found' });
    }

    const ride = rideResult.rows[0];

    if (!ride.rsvp_required) {
      return res.status(400).json({
        success: false,
        error: 'This ride does not require RSVP. Just show up and enjoy the ride!',
      });
    }

    if (ride.status !== 'published') {
      return res.status(400).json({ success: false, error: 'Cannot RSVP to this ride' });
    }

    if (ride.rsvp_deadline && new Date(ride.rsvp_deadline) < new Date()) {
      return res.status(400).json({ success: false, error: 'RSVP deadline has passed' });
    }

    // Check max participants if status is 'going'
    if (status === 'going' && ride.max_participants) {
      const countResult = await pool.query(
        `SELECT COUNT(*) + SUM(guests) as total
         FROM ride_participants
         WHERE ride_id = $1 AND rsvp_status = 'going'`,
        [id]
      );
      const currentCount = parseInt(countResult.rows[0].total) || 0;

      if (currentCount + 1 + guests > ride.max_participants) {
        return res.status(400).json({ success: false, error: 'Ride is at maximum capacity' });
      }
    }

    // Upsert RSVP
    await pool.query(
      `INSERT INTO ride_participants (id, ride_id, member_id, rsvp_status, rsvp_date, guests)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       ON CONFLICT (ride_id, member_id)
       DO UPDATE SET rsvp_status = $4, rsvp_date = NOW(), guests = $5`,
      [uuidv4(), id, memberId, status, guests]
    );

    logger.info(`Member ${memberId} RSVPed ${status} to ride ${id}`);

    res.json({ success: true, message: 'RSVP recorded successfully' });
  } catch (error) {
    next(error);
  }
});

// Record attendance (for completed rides)
router.post(
  '/:id/attendance',
  authenticate,
  requireRole('admin', 'director', 'officer', 'road_captain'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { memberIds, mileage } = req.body;

      if (!Array.isArray(memberIds)) {
        return res.status(400).json({ success: false, error: 'memberIds must be an array' });
      }

      // Mark attendance for each member
      for (const memberId of memberIds) {
        await pool.query(
          `INSERT INTO ride_participants (id, ride_id, member_id, attended, mileage_logged)
           VALUES ($1, $2, $3, true, $4)
           ON CONFLICT (ride_id, member_id)
           DO UPDATE SET attended = true, mileage_logged = $4`,
          [uuidv4(), id, memberId, mileage || null]
        );
      }

      // Update ride actual distance if provided
      if (mileage) {
        await pool.query(
          'UPDATE rides SET actual_distance = $1 WHERE id = $2',
          [mileage, id]
        );
      }

      logger.info(`Attendance recorded for ride ${id}: ${memberIds.length} members`);

      res.json({ success: true, message: 'Attendance recorded successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Add ride report (post-ride)
router.post(
  '/:id/report',
  authenticate,
  requireRole('admin', 'director', 'officer', 'road_captain'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { rideReport, actualDistance, actualDuration, weatherConditions } = req.body;

      await pool.query(
        `UPDATE rides
         SET ride_report = $1, actual_distance = $2, actual_duration = $3,
             weather_conditions = $4, status = 'completed'
         WHERE id = $5`,
        [rideReport, actualDistance, actualDuration, weatherConditions, id]
      );

      res.json({ success: true, message: 'Ride report saved' });
    } catch (error) {
      next(error);
    }
  }
);

// Get weather for a ride date/location
router.get('/:id/weather', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const rideResult = await pool.query(
      'SELECT start_date, meetup_lat, meetup_lng FROM rides WHERE id = $1',
      [id]
    );

    if (rideResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ride not found' });
    }

    const ride = rideResult.rows[0];

    if (!ride.meetup_lat || !ride.meetup_lng) {
      return res.status(400).json({ success: false, error: 'Ride location not set' });
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ success: false, error: 'Weather service not configured' });
    }

    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${ride.meetup_lat}&lon=${ride.meetup_lng}&appid=${apiKey}&units=imperial`
    );

    res.json({ success: true, data: response.data });
  } catch (error) {
    next(error);
  }
});

// Add waypoints to a ride
router.post(
  '/:id/waypoints',
  authenticate,
  requireRole('admin', 'director', 'officer', 'road_captain'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { waypoints } = req.body;

      if (!Array.isArray(waypoints)) {
        return res.status(400).json({ success: false, error: 'waypoints must be an array' });
      }

      // Delete existing waypoints
      await pool.query('DELETE FROM ride_waypoints WHERE ride_id = $1', [id]);

      // Insert new waypoints
      for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        await pool.query(
          `INSERT INTO ride_waypoints (id, ride_id, sequence_order, name, address, lat, lng, stop_type, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [uuidv4(), id, i + 1, wp.name, wp.address, wp.lat, wp.lng, wp.stopType, wp.notes]
        );
      }

      res.json({ success: true, message: 'Waypoints saved' });
    } catch (error) {
      next(error);
    }
  }
);

export { router as rideRouter };
