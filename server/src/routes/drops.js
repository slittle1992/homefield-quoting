const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { scheduleNextDrop } = require('../services/campaignService');

const router = express.Router();

// GET /api/drops/today - get today's and upcoming drop queue
router.get('/today', authenticate, async (req, res) => {
  try {
    const { days } = req.query;
    const lookAheadDays = parseInt(days) || 7;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + lookAheadDays);
    const endDateStr = endDate.toISOString().split('T')[0];

    const conditions = [`dq.scheduled_date <= $1`, `dq.status IN ('queued', 'assigned')`];
    const params = [endDateStr];

    // If driver role, only show their assigned drops
    if (req.user.role === 'driver') {
      conditions.push(`dq.assigned_driver_id = $2`);
      params.push(req.user.id);
    }

    const result = await pool.query(`
      SELECT dq.*, p.address, p.address AS address_street, p.city, p.city AS address_city,
             p.state, p.state AS address_state, p.zip, p.zip AS address_zip,
             p.latitude, p.longitude,
             p.owner_name, p.pool_type, p.lead_source, p.subdivision,
             p.campaign_drops_completed, p.campaign_total_drops
      FROM drop_queue dq
      JOIN properties p ON p.id = dq.property_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY dq.scheduled_date ASC, dq.priority DESC, dq.id ASC
    `, params);

    res.json({ drops: result.rows });
  } catch (err) {
    console.error('Get today drops error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/drops/history - get delivery history
router.get('/history', authenticate, async (req, res) => {
  try {
    const { start_date, end_date, property_id, driver_id, limit = 100, offset = 0 } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      conditions.push(`dq.delivered_at >= $${paramIndex++}`);
      params.push(start_date);
    }

    if (end_date) {
      conditions.push(`dq.delivered_at <= $${paramIndex++}`);
      params.push(end_date);
    }

    if (property_id) {
      conditions.push(`dq.property_id = $${paramIndex++}`);
      params.push(property_id);
    }

    if (driver_id) {
      conditions.push(`dq.assigned_driver_id = $${paramIndex++}`);
      params.push(driver_id);
    }

    conditions.push(`dq.status = 'delivered'`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*)::INTEGER as count FROM drop_queue dq ${whereClause}`,
      params
    );

    const dataParams = [...params, parseInt(limit), parseInt(offset)];
    const result = await pool.query(`
      SELECT dq.*, p.address, p.city, p.zip, p.owner_name, p.subdivision,
             d.name as driver_name
      FROM drop_queue dq
      JOIN properties p ON p.id = dq.property_id
      LEFT JOIN drivers d ON d.id = dq.assigned_driver_id
      ${whereClause}
      ORDER BY dq.delivered_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, dataParams);

    res.json({
      drops: result.rows,
      total: countResult.rows[0].count,
    });
  } catch (err) {
    console.error('Get drop history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/drops/stats - delivery counts
router.get('/stats', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const dailyResult = await pool.query(`
      SELECT COUNT(*)::INTEGER as count
      FROM drop_queue
      WHERE status = 'delivered' AND delivered_at::date = $1
    `, [today]);

    const weeklyResult = await pool.query(`
      SELECT COUNT(*)::INTEGER as count
      FROM drop_queue
      WHERE status = 'delivered' AND delivered_at >= NOW() - INTERVAL '7 days'
    `);

    const monthlyResult = await pool.query(`
      SELECT COUNT(*)::INTEGER as count
      FROM drop_queue
      WHERE status = 'delivered' AND delivered_at >= NOW() - INTERVAL '30 days'
    `);

    const queuedResult = await pool.query(`
      SELECT COUNT(*)::INTEGER as count
      FROM drop_queue
      WHERE status IN ('queued', 'assigned')
    `);

    const dailyBreakdown = await pool.query(`
      SELECT delivered_at::date as date, COUNT(*)::INTEGER as count
      FROM drop_queue
      WHERE status = 'delivered' AND delivered_at >= NOW() - INTERVAL '30 days'
      GROUP BY delivered_at::date
      ORDER BY date DESC
    `);

    res.json({
      today: dailyResult.rows[0].count,
      this_week: weeklyResult.rows[0].count,
      this_month: monthlyResult.rows[0].count,
      queued: queuedResult.rows[0].count,
      daily_breakdown: dailyBreakdown.rows,
    });
  } catch (err) {
    console.error('Get drop stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/drops/generate - generate today's drop list
router.post('/generate', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dailyLimit = parseInt(process.env.DAILY_DROP_LIMIT || '50');

    // Find eligible properties
    const result = await pool.query(`
      SELECT p.id, p.lead_source, p.campaign_drops_completed, p.campaign_total_drops
      FROM properties p
      WHERE (p.campaign_next_drop_date IS NULL OR p.campaign_next_drop_date <= $1)
        AND p.campaign_status IN ('not_started', 'flyer_in_progress')
        AND p.do_not_drop = false
        AND p.campaign_drops_completed < p.campaign_total_drops
        AND NOT EXISTS (
          SELECT 1 FROM drop_queue dq
          WHERE dq.property_id = p.id AND dq.status IN ('queued', 'assigned')
        )
      ORDER BY p.campaign_next_drop_date ASC NULLS FIRST
    `, [today]);

    // Assign priorities
    const prioritized = result.rows.map((p) => {
      let priority = 10; // default for cold/manual leads
      if (p.lead_source === 'mls') {
        priority = 30;
      } else if (p.lead_source === 'permit') {
        priority = 25;
      } else if (p.campaign_drops_completed > 0) {
        priority = 20; // in-progress campaigns
      }
      return { ...p, priority };
    });

    // Sort by priority descending
    prioritized.sort((a, b) => b.priority - a.priority);

    // Cap at daily limit
    const toGenerate = prioritized.slice(0, dailyLimit);

    // Find the first active driver to assign drops to
    const driverResult = await pool.query(
      `SELECT id FROM users WHERE role = 'driver' ORDER BY id ASC LIMIT 1`
    );
    const driverId = driverResult.rows.length > 0 ? driverResult.rows[0].id : null;

    // Insert into drop_queue
    const generated = [];
    for (const prop of toGenerate) {
      const dropNumber = prop.campaign_drops_completed + 1;
      const insertResult = await pool.query(`
        INSERT INTO drop_queue (property_id, drop_number, scheduled_date, priority, status, assigned_driver_id)
        VALUES ($1, $2, $3, $4, 'assigned', $5)
        RETURNING *
      `, [prop.id, dropNumber, today, prop.priority, driverId]);

      generated.push(insertResult.rows[0]);
    }

    res.json({
      generated_count: generated.length,
      total_eligible: result.rows.length,
      daily_limit: dailyLimit,
      drops: generated,
    });
  } catch (err) {
    console.error('Generate drops error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/drops/:id/deliver - mark a drop as delivered
router.post('/:id/deliver', authenticate, async (req, res) => {
  try {
    const { delivery_lat, delivery_lng, delivery_notes, delivery_photo_url } = req.body;

    // Get the drop
    const dropResult = await pool.query(
      'SELECT * FROM drop_queue WHERE id = $1',
      [req.params.id]
    );

    if (dropResult.rows.length === 0) {
      return res.status(404).json({ error: 'Drop not found' });
    }

    const drop = dropResult.rows[0];

    // Get property for distance calculation
    const propResult = await pool.query(
      'SELECT latitude, longitude, campaign_total_drops FROM properties WHERE id = $1',
      [drop.property_id]
    );

    const property = propResult.rows[0];

    // Calculate distance if both coords available
    let distanceMeters = null;
    if (delivery_lat && delivery_lng && property.latitude && property.longitude) {
      // Haversine distance in meters
      const distResult = await pool.query(`
        SELECT (
          6371000 * acos(
            cos(radians($1)) * cos(radians($3)) *
            cos(radians($4) - radians($2)) +
            sin(radians($1)) * sin(radians($3))
          )
        ) as distance
      `, [delivery_lat, delivery_lng, property.latitude, property.longitude]);
      distanceMeters = distResult.rows[0].distance;
    }

    // Update drop as delivered
    const updatedDrop = await pool.query(`
      UPDATE drop_queue
      SET status = 'delivered',
          delivered_at = NOW(),
          delivery_lat = $1,
          delivery_lng = $2,
          delivery_notes = $3,
          delivery_photo_url = $4,
          delivery_distance_meters = $5
      WHERE id = $6
      RETURNING *
    `, [
      delivery_lat || null,
      delivery_lng || null,
      delivery_notes || null,
      delivery_photo_url || null,
      distanceMeters,
      req.params.id,
    ]);

    // Update property campaign progress
    const newDropsCompleted = drop.drop_number;

    if (newDropsCompleted < property.campaign_total_drops) {
      // Schedule next drop
      await scheduleNextDrop(drop.property_id, drop.drop_number);
    } else {
      // Campaign complete
      await pool.query(`
        UPDATE properties
        SET campaign_drops_completed = $1,
            campaign_status = 'flyer_complete',
            campaign_next_drop_date = NULL,
            updated_at = NOW()
        WHERE id = $2
      `, [newDropsCompleted, drop.property_id]);
    }

    res.json({ drop: updatedDrop.rows[0] });
  } catch (err) {
    console.error('Deliver drop error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/drops/:id/skip - mark drop as skipped
router.post('/:id/skip', authenticate, async (req, res) => {
  try {
    const { delivery_notes } = req.body;

    const result = await pool.query(`
      UPDATE drop_queue
      SET status = 'skipped', delivery_notes = $1
      WHERE id = $2
      RETURNING *
    `, [delivery_notes || null, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Drop not found' });
    }

    res.json({ drop: result.rows[0] });
  } catch (err) {
    console.error('Skip drop error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Alias: POST /generate-route -> same logic as /generate
router.post('/generate-route', authenticate, requireRole('admin'), (req, res) => {
  req.url = '/generate';
  router.handle(req, res, () => res.status(404).json({ error: 'Not found' }));
});

// POST /queue/:propertyId - manually queue a drop for a property
router.post('/queue/:propertyId', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { propertyId } = req.params;
    const today = new Date().toISOString().split('T')[0];

    const prop = await pool.query('SELECT * FROM properties WHERE id = $1', [propertyId]);
    if (prop.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const property = prop.rows[0];
    const dropNumber = (property.campaign_drops_completed || 0) + 1;

    const result = await pool.query(`
      INSERT INTO drop_queue (property_id, drop_number, scheduled_date, status)
      VALUES ($1, $2, $3, 'queued')
      ON CONFLICT DO NOTHING
      RETURNING *
    `, [propertyId, dropNumber, today]);

    res.json({ drop: result.rows[0] || null });
  } catch (err) {
    console.error('Queue drop error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
