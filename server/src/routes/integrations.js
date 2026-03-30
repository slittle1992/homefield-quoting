const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/integrations/lob - save Lob API key + company info
router.post('/lob', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { api_key, company_name, address_line1, address_line2, city, state, zip } = req.body;

    if (!api_key) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const config = JSON.stringify({
      api_key,
      company_name: company_name || '',
      address_line1: address_line1 || '',
      address_line2: address_line2 || '',
      city: city || '',
      state: state || '',
      zip: zip || '',
    });

    const existing = await pool.query(
      'SELECT id FROM integrations WHERE provider = $1',
      ['lob']
    );

    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE integrations SET config = $1, updated_at = NOW() WHERE provider = $2',
        [config, 'lob']
      );
    } else {
      await pool.query(
        'INSERT INTO integrations (provider, config, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())',
        ['lob', config]
      );
    }

    res.json({ message: 'Lob configuration saved' });
  } catch (err) {
    console.error('Save Lob config error:', err);
    res.status(500).json({ error: 'Failed to save Lob configuration' });
  }
});

// GET /api/integrations/lob - get current Lob config
router.get('/lob', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT config, updated_at FROM integrations WHERE provider = $1',
      ['lob']
    );

    if (result.rows.length === 0) {
      return res.json({ configured: false, config: null });
    }

    const config = typeof result.rows[0].config === 'string'
      ? JSON.parse(result.rows[0].config)
      : result.rows[0].config;

    // Mask the API key for security
    if (config.api_key) {
      config.api_key_masked = config.api_key.slice(0, 8) + '...' + config.api_key.slice(-4);
    }

    res.json({
      configured: true,
      config: { ...config, api_key: undefined, api_key_masked: config.api_key_masked },
      updated_at: result.rows[0].updated_at,
    });
  } catch (err) {
    console.error('Get Lob config error:', err);
    res.status(500).json({ error: 'Failed to get Lob configuration' });
  }
});

// GET /api/integrations/permits - get permit scraping config
router.get('/permits', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT config, updated_at FROM integrations WHERE provider = $1',
      ['permits']
    );

    if (result.rows.length === 0) {
      return res.json({ configured: false, config: null });
    }

    const config = typeof result.rows[0].config === 'string'
      ? JSON.parse(result.rows[0].config)
      : result.rows[0].config;

    res.json({
      configured: true,
      config,
      updated_at: result.rows[0].updated_at,
    });
  } catch (err) {
    console.error('Get permits config error:', err);
    res.status(500).json({ error: 'Failed to get permit configuration' });
  }
});

// PUT /api/integrations/permits - update permit config
router.put('/permits', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { enabled_counties, scrape_interval_hours, auto_scrape } = req.body;

    const config = JSON.stringify({
      enabled_counties: enabled_counties || [],
      scrape_interval_hours: scrape_interval_hours || 24,
      auto_scrape: auto_scrape ?? false,
    });

    const existing = await pool.query(
      'SELECT id FROM integrations WHERE provider = $1',
      ['permits']
    );

    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE integrations SET config = $1, updated_at = NOW() WHERE provider = $2',
        [config, 'permits']
      );
    } else {
      await pool.query(
        'INSERT INTO integrations (provider, config, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())',
        ['permits', config]
      );
    }

    res.json({ message: 'Permit configuration updated' });
  } catch (err) {
    console.error('Update permits config error:', err);
    res.status(500).json({ error: 'Failed to update permit configuration' });
  }
});

// POST /api/integrations/permits/scrape - trigger manual permit scrape
router.post('/permits/scrape', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const configResult = await pool.query(
      'SELECT config FROM integrations WHERE provider = $1',
      ['permits']
    );

    if (configResult.rows.length === 0) {
      return res.status(400).json({ error: 'Permit scraping is not configured' });
    }

    const config = typeof configResult.rows[0].config === 'string'
      ? JSON.parse(configResult.rows[0].config)
      : configResult.rows[0].config;

    // Log the scrape request
    await pool.query(
      `INSERT INTO integrations (provider, config, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      ['permits_scrape_log', JSON.stringify({ triggered_at: new Date().toISOString(), status: 'started' })]
    );

    // In a real implementation this would kick off an async scraping job.
    // For now we return a success response indicating the scrape was triggered.
    res.json({
      message: 'Permit scrape triggered',
      counties: config.enabled_counties || [],
      status: 'started',
    });
  } catch (err) {
    console.error('Trigger permit scrape error:', err);
    res.status(500).json({ error: 'Failed to trigger permit scrape' });
  }
});

module.exports = router;
