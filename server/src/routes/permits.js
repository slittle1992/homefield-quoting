const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { getCountyConfig, getRegisteredCounties, COUNTY_CONFIGS } = require('../services/permitScraper');
const { scrapeCounty } = require('../services/permitWorker');

const router = express.Router();

// All permit routes require auth + admin
router.use(authenticate, requireRole('admin'));

/**
 * GET /api/permits/imports
 * List recent permit imports with pagination.
 */
router.get('/imports', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const county = req.query.county || null;

    let whereClause = '';
    const params = [limit, offset];

    if (county) {
      whereClause = 'WHERE pi.county = $3';
      params.push(county);
    }

    const [imports, countResult] = await Promise.all([
      pool.query(`
        SELECT pi.id, pi.property_id, pi.county, pi.permit_number,
               pi.permit_date, pi.permit_type, pi.created_at,
               p.address, p.owner_name, p.campaign_status
        FROM permit_imports pi
        LEFT JOIN properties p ON p.id = pi.property_id
        ${whereClause}
        ORDER BY pi.created_at DESC
        LIMIT $1 OFFSET $2
      `, params),
      pool.query(`
        SELECT COUNT(*) as total
        FROM permit_imports pi
        ${whereClause}
      `, county ? [county] : []),
    ]);

    const total = parseInt(countResult.rows[0].total);

    res.json({
      imports: imports.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Permits: error listing imports:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/permits/scrape
 * Manually trigger a scrape for a specific county.
 */
router.post('/scrape', async (req, res) => {
  try {
    const { county } = req.body;

    if (!county) {
      return res.status(400).json({ error: 'County is required' });
    }

    const config = getCountyConfig(county);
    if (!config) {
      return res.status(400).json({ error: `No configuration found for county: ${county}` });
    }

    const results = await scrapeCounty(county);

    res.json({
      county,
      ...results,
    });
  } catch (err) {
    console.error('Permits: error triggering scrape:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/permits/counties
 * List available counties with their config and stats.
 */
router.get('/counties', async (req, res) => {
  try {
    const registeredCounties = getRegisteredCounties();

    // Get stats for each county from permit_imports
    const statsResult = await pool.query(`
      SELECT county,
             COUNT(*) as total_imported,
             MAX(created_at) as last_scraped
      FROM permit_imports
      GROUP BY county
    `);

    const statsMap = {};
    for (const row of statsResult.rows) {
      statsMap[row.county] = {
        total_imported: parseInt(row.total_imported),
        last_scraped: row.last_scraped,
      };
    }

    // Also load any custom counties saved in integrations table
    let savedCounties = [];
    try {
      const savedResult = await pool.query(`
        SELECT config FROM integrations
        WHERE provider = 'permit_scraper' AND is_active = true
      `);
      savedCounties = savedResult.rows.map((r) => r.config);
    } catch (err) {
      // integrations table may not exist yet — that is fine
    }

    // Merge built-in and saved counties
    const counties = registeredCounties.map((key) => {
      const config = COUNTY_CONFIGS[key];
      const stats = statsMap[key] || { total_imported: 0, last_scraped: null };
      return {
        key,
        name: config.name,
        base_url: config.baseUrl,
        ...stats,
      };
    });

    // Add any saved counties not in the built-in list
    for (const saved of savedCounties) {
      if (saved && saved.key && !registeredCounties.includes(saved.key)) {
        const stats = statsMap[saved.key] || { total_imported: 0, last_scraped: null };
        counties.push({
          key: saved.key,
          name: saved.name,
          base_url: saved.baseUrl,
          ...stats,
        });
      }
    }

    res.json({ counties });
  } catch (err) {
    console.error('Permits: error listing counties:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/permits/counties
 * Add or update a county config (saved to integrations table).
 */
router.post('/counties', async (req, res) => {
  try {
    const { name, key, baseUrl, searchUrl } = req.body;

    if (!name || !key || !baseUrl) {
      return res.status(400).json({ error: 'name, key, and baseUrl are required' });
    }

    const countyKey = key.toLowerCase().replace(/\s+/g, '_');
    const config = {
      key: countyKey,
      name,
      baseUrl,
      searchUrl: searchUrl || '/api/permits/search',
    };

    // Register in runtime config
    COUNTY_CONFIGS[countyKey] = {
      name,
      baseUrl,
      searchUrl: config.searchUrl,
      keywords: ['pool', 'spa', 'swimming', 'aquatic'],
      parser: null,
    };

    // Persist to integrations table
    await pool.query(`
      INSERT INTO integrations (provider, name, config, is_active)
      VALUES ('permit_scraper', $1, $2, true)
      ON CONFLICT (provider, name) DO UPDATE SET
        config = EXCLUDED.config,
        updated_at = NOW()
    `, [countyKey, JSON.stringify(config)]);

    res.json({ county: config });
  } catch (err) {
    console.error('Permits: error saving county config:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
