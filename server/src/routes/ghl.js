const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const ghlService = require('../services/ghlService');

const router = express.Router();

// GET /api/ghl/status - check if GHL is configured
router.get('/status', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT key, value FROM integrations WHERE key IN ('ghl_api_key', 'ghl_location_id')"
    );

    const config = {};
    for (const row of result.rows) {
      config[row.key] = row.value;
    }

    const connected = !!(config.ghl_api_key && config.ghl_location_id);

    res.json({
      connected,
      has_api_key: !!config.ghl_api_key,
      has_location_id: !!config.ghl_location_id,
    });
  } catch (err) {
    console.error('GHL status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/ghl/connect - save GHL integration credentials
router.post('/connect', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { api_key, location_id } = req.body;

    if (!api_key || !location_id) {
      return res.status(400).json({ error: 'api_key and location_id are required' });
    }

    // Upsert api_key
    await pool.query(
      `INSERT INTO integrations (key, value, updated_at)
       VALUES ('ghl_api_key', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [api_key]
    );

    // Upsert location_id
    await pool.query(
      `INSERT INTO integrations (key, value, updated_at)
       VALUES ('ghl_location_id', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [location_id]
    );

    res.json({ message: 'GHL integration connected successfully' });
  } catch (err) {
    console.error('GHL connect error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/ghl/disconnect - remove GHL integration
router.delete('/disconnect', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM integrations WHERE key IN ('ghl_api_key', 'ghl_location_id', 'ghl_workflow_id')"
    );

    res.json({ message: 'GHL integration disconnected' });
  } catch (err) {
    console.error('GHL disconnect error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/ghl/test - test GHL connection
router.post('/test', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await ghlService.searchContactByEmail('test@pooldrop.com');
    res.json({
      success: true,
      message: 'GHL connection is working',
      data: result,
    });
  } catch (err) {
    console.error('GHL test error:', err);
    res.status(400).json({
      success: false,
      message: 'GHL connection test failed',
      error: err.message,
    });
  }
});

module.exports = router;
