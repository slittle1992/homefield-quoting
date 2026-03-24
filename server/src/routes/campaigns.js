const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/campaigns/schedule - get campaign and mailer schedules
router.get('/schedule', authenticate, async (req, res) => {
  try {
    const campaignSchedule = await pool.query(
      'SELECT * FROM campaign_schedule ORDER BY drop_number'
    );

    const mailerSchedule = await pool.query(
      'SELECT * FROM mailer_schedule ORDER BY mailer_number'
    );

    res.json({
      campaign_schedule: campaignSchedule.rows,
      mailer_schedule: mailerSchedule.rows,
    });
  } catch (err) {
    console.error('Get schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/campaigns/schedule - update campaign schedule
router.put('/schedule', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { schedule } = req.body;

    if (!Array.isArray(schedule)) {
      return res.status(400).json({ error: 'schedule must be an array of { drop_number, days_after_previous }' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const item of schedule) {
        await client.query(
          `INSERT INTO campaign_schedule (drop_number, days_after_previous)
           VALUES ($1, $2)
           ON CONFLICT (drop_number) DO UPDATE SET days_after_previous = EXCLUDED.days_after_previous`,
          [item.drop_number, item.days_after_previous]
        );
      }

      await client.query('COMMIT');

      const result = await pool.query('SELECT * FROM campaign_schedule ORDER BY drop_number');
      res.json({ campaign_schedule: result.rows });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update campaign schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/campaigns/mailer-schedule - update mailer schedule
router.put('/mailer-schedule', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { schedule } = req.body;

    if (!Array.isArray(schedule)) {
      return res.status(400).json({ error: 'schedule must be an array of { mailer_number, days_after_previous }' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const item of schedule) {
        await client.query(
          `INSERT INTO mailer_schedule (mailer_number, days_after_previous)
           VALUES ($1, $2)
           ON CONFLICT (mailer_number) DO UPDATE SET days_after_previous = EXCLUDED.days_after_previous`,
          [item.mailer_number, item.days_after_previous]
        );
      }

      await client.query('COMMIT');

      const result = await pool.query('SELECT * FROM mailer_schedule ORDER BY mailer_number');
      res.json({ mailer_schedule: result.rows });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update mailer schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/campaigns/pipeline - return pipeline counts
router.get('/pipeline', authenticate, async (req, res) => {
  try {
    const statusCounts = await pool.query(`
      SELECT campaign_status, COUNT(*)::INTEGER as count
      FROM properties
      GROUP BY campaign_status
    `);

    // Break down flyer_in_progress by drop number
    const flyerBreakdown = await pool.query(`
      SELECT campaign_drops_completed, COUNT(*)::INTEGER as count
      FROM properties
      WHERE campaign_status = 'flyer_in_progress'
      GROUP BY campaign_drops_completed
      ORDER BY campaign_drops_completed
    `);

    // Mailer in progress
    const mailerInProgress = await pool.query(`
      SELECT COUNT(*)::INTEGER as count
      FROM properties
      WHERE campaign_status = 'mailer_in_progress'
    `);

    const mailerComplete = await pool.query(`
      SELECT COUNT(*)::INTEGER as count
      FROM properties
      WHERE campaign_status = 'mailer_complete'
    `);

    const fbExported = await pool.query(`
      SELECT COUNT(*)::INTEGER as count
      FROM properties
      WHERE fb_exported_at IS NOT NULL
    `);

    const converted = await pool.query(`
      SELECT COUNT(*)::INTEGER as count
      FROM properties
      WHERE converted_at IS NOT NULL
    `);

    const archived = await pool.query(`
      SELECT COUNT(*)::INTEGER as count
      FROM properties
      WHERE campaign_status = 'archived'
    `);

    const pipeline = {
      not_started: 0,
      flyer_in_progress: {
        total: 0,
        by_drop: [],
      },
      flyer_complete: 0,
      mailer_in_progress: mailerInProgress.rows[0].count,
      mailer_complete: mailerComplete.rows[0].count,
      fb_exported: fbExported.rows[0].count,
      converted: converted.rows[0].count,
      archived: archived.rows[0].count,
    };

    for (const row of statusCounts.rows) {
      if (row.campaign_status === 'not_started') {
        pipeline.not_started = row.count;
      } else if (row.campaign_status === 'flyer_in_progress') {
        pipeline.flyer_in_progress.total = row.count;
      } else if (row.campaign_status === 'flyer_complete') {
        pipeline.flyer_complete = row.count;
      }
    }

    pipeline.flyer_in_progress.by_drop = flyerBreakdown.rows.map((r) => ({
      drops_completed: r.campaign_drops_completed,
      count: r.count,
    }));

    res.json({ pipeline });
  } catch (err) {
    console.error('Get pipeline error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
