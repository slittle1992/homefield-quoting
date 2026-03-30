const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const metaService = require('../services/metaService');

const router = express.Router();

function parseOwnerName(ownerName) {
  if (!ownerName) return { firstName: '', lastName: '' };
  const cleaned = ownerName.trim();
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',').map((p) => p.trim());
    return { firstName: parts[1] || '', lastName: parts[0] || '' };
  }
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: '', lastName: parts[0] };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build filter conditions and params from request body, matching export.js logic.
 */
function buildFilterQuery(filters) {
  const { campaign_status, lead_source, subdivision, date_range } = filters;
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (campaign_status) {
    const statuses = Array.isArray(campaign_status) ? campaign_status : [campaign_status];
    const placeholders = statuses.map(() => `$${paramIndex++}`);
    conditions.push(`campaign_status IN (${placeholders.join(', ')})`);
    params.push(...statuses);
  }

  if (lead_source) {
    conditions.push(`lead_source = $${paramIndex++}`);
    params.push(lead_source);
  }

  if (subdivision) {
    conditions.push(`subdivision ILIKE $${paramIndex++}`);
    params.push(`%${subdivision}%`);
  }

  if (date_range) {
    if (date_range.start) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(date_range.start);
    }
    if (date_range.end) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(date_range.end);
    }
  }

  conditions.push('address IS NOT NULL');

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
}

/**
 * Calculate centroid (average lat/lng) from a set of properties.
 * Falls back to first property with coordinates if averaging is not possible.
 */
function calculateCentroid(properties) {
  const withCoords = properties.filter((p) => p.latitude && p.longitude);
  if (withCoords.length === 0) return null;

  const totalLat = withCoords.reduce((sum, p) => sum + parseFloat(p.latitude), 0);
  const totalLng = withCoords.reduce((sum, p) => sum + parseFloat(p.longitude), 0);

  return {
    latitude: totalLat / withCoords.length,
    longitude: totalLng / withCoords.length,
  };
}

// POST /api/meta/launch - one-button Meta campaign launch
router.post('/launch', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const {
      campaign_status,
      lead_source,
      subdivision,
      date_range,
      daily_budget = 2000,
      duration_days = 14,
      template_index = 0,
    } = req.body;

    // 1. Query matching properties
    const { whereClause, params } = buildFilterQuery({ campaign_status, lead_source, subdivision, date_range });
    const result = await pool.query(
      `SELECT id, owner_name, address, city, state, zip, latitude, longitude FROM properties ${whereClause}`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No properties match the filter criteria' });
    }

    const properties = result.rows;
    const timestamp = new Date().toISOString().split('T')[0];
    const campaignName = `PoolDrop - ${subdivision || 'All Areas'} - ${timestamp}`;

    // 2. Create Custom Audience
    const audience = await metaService.createCustomAudience(
      `PoolDrop Audience - ${timestamp}`,
      `${properties.length} properties from PoolDrop filters`
    );
    const audienceId = audience.id;

    // 3. Upload hashed property data to audience
    const users = properties.map((row) => {
      const { firstName, lastName } = parseOwnerName(row.owner_name);
      return {
        fn: toTitleCase(firstName),
        ln: toTitleCase(lastName),
        st: row.address || '',
        ct: row.city || '',
        zip: row.zip || '',
        country: 'US',
      };
    });
    await metaService.uploadAudienceData(audienceId, users);

    // 4. Create Campaign (PAUSED)
    const campaign = await metaService.createCampaign(campaignName, daily_budget, 'OUTCOME_AWARENESS');
    const campaignId = campaign.id;

    // 5. Create AdSet with geo-targeting
    const centroid = calculateCentroid(properties);
    const geo = centroid
      ? { custom_locations: [{ latitude: centroid.latitude, longitude: centroid.longitude, radius: 10, distance_unit: 'mile' }] }
      : { countries: ['US'] };

    const adSet = await metaService.createAdSet(
      campaignId,
      audienceId,
      `${campaignName} - AdSet`,
      daily_budget,
      geo
    );
    const adSetId = adSet.id;

    // 6. Create AdCreative using selected template
    const templates = metaService.getAdTemplates();
    const template = templates[template_index] || templates[0];
    const pageId = process.env.META_PAGE_ID || '';
    const linkUrl = process.env.COMPANY_WEBSITE || 'https://example.com';
    const imageUrl = process.env.META_AD_IMAGE_URL || '';

    const creative = await metaService.createAdCreative(
      pageId,
      template.primary_text,
      template.headline,
      template.description,
      linkUrl,
      imageUrl
    );
    const creativeId = creative.id;

    // 7. Create Ad
    const ad = await metaService.createAd(adSetId, creativeId, `${campaignName} - Ad`);

    // 8. Save to meta_campaigns table
    const insertResult = await pool.query(
      `INSERT INTO meta_campaigns
       (campaign_id, campaign_name, audience_id, adset_id, ad_id, creative_id,
        status, daily_budget, duration_days, template_index, property_count,
        filter_criteria, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        campaignId,
        campaignName,
        audienceId,
        adSetId,
        ad.id,
        creativeId,
        'PAUSED',
        daily_budget,
        duration_days,
        template_index,
        properties.length,
        JSON.stringify({ campaign_status, lead_source, subdivision, date_range }),
        req.user.id,
      ]
    );

    res.json({
      message: 'Meta campaign created successfully',
      campaign: insertResult.rows[0],
      meta_ids: {
        campaign_id: campaignId,
        audience_id: audienceId,
        adset_id: adSetId,
        creative_id: creativeId,
        ad_id: ad.id,
      },
    });
  } catch (err) {
    console.error('Meta launch error:', err);
    res.status(500).json({ error: 'Failed to launch Meta campaign', details: err.message });
  }
});

// GET /api/meta/campaigns - list all Meta campaigns
router.get('/campaigns', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM meta_campaigns ORDER BY created_at DESC'
    );
    res.json({ campaigns: result.rows });
  } catch (err) {
    console.error('Meta campaigns list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/meta/campaigns/:id - get single campaign with live insights
router.get('/campaigns/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM meta_campaigns WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = result.rows[0];

    // Fetch live insights from Meta API
    let insights = null;
    try {
      const insightsData = await metaService.getCampaignInsights(campaign.campaign_id);
      insights = insightsData.data?.[0] || null;

      if (insights) {
        await pool.query(
          `UPDATE meta_campaigns
           SET reach = $1, impressions = $2, clicks = $3, insights_updated_at = NOW()
           WHERE id = $4`,
          [
            parseInt(insights.reach || 0, 10),
            parseInt(insights.impressions || 0, 10),
            parseInt(insights.clicks || 0, 10),
            id,
          ]
        );
        campaign.reach = parseInt(insights.reach || 0, 10);
        campaign.impressions = parseInt(insights.impressions || 0, 10);
        campaign.clicks = parseInt(insights.clicks || 0, 10);
        campaign.insights_updated_at = new Date().toISOString();
      }
    } catch (insightsErr) {
      console.error('Failed to fetch Meta insights:', insightsErr.message);
    }

    res.json({ campaign, insights });
  } catch (err) {
    console.error('Meta campaign detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/meta/campaigns/:id/activate - activate campaign
router.post('/campaigns/:id/activate', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM meta_campaigns WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = result.rows[0];
    await metaService.updateCampaignStatus(campaign.campaign_id, 'ACTIVE');

    await pool.query(
      'UPDATE meta_campaigns SET status = $1, updated_at = NOW() WHERE id = $2',
      ['ACTIVE', id]
    );

    res.json({ message: 'Campaign activated', status: 'ACTIVE' });
  } catch (err) {
    console.error('Meta campaign activate error:', err);
    res.status(500).json({ error: 'Failed to activate campaign', details: err.message });
  }
});

// POST /api/meta/campaigns/:id/pause - pause campaign
router.post('/campaigns/:id/pause', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM meta_campaigns WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = result.rows[0];
    await metaService.updateCampaignStatus(campaign.campaign_id, 'PAUSED');

    await pool.query(
      'UPDATE meta_campaigns SET status = $1, updated_at = NOW() WHERE id = $2',
      ['PAUSED', id]
    );

    res.json({ message: 'Campaign paused', status: 'PAUSED' });
  } catch (err) {
    console.error('Meta campaign pause error:', err);
    res.status(500).json({ error: 'Failed to pause campaign', details: err.message });
  }
});

// GET /api/meta/templates - get available ad templates
router.get('/templates', authenticate, requireRole('admin'), (req, res) => {
  res.json({ templates: metaService.getAdTemplates() });
});

// GET /api/meta/status - check if Meta is configured
router.get('/status', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT config, updated_at FROM integrations WHERE provider = 'meta'"
    );

    if (result.rows.length === 0) {
      return res.json({ configured: false });
    }

    const config = typeof result.rows[0].config === 'string'
      ? JSON.parse(result.rows[0].config)
      : result.rows[0].config;

    res.json({
      configured: true,
      has_access_token: !!config.access_token,
      has_ad_account: !!config.ad_account_id,
      updated_at: result.rows[0].updated_at,
    });
  } catch (err) {
    console.error('Meta status check error:', err);
    res.status(500).json({ error: 'Failed to check Meta status' });
  }
});

// POST /api/meta/connect - save Meta credentials to integrations table
router.post('/connect', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { access_token, ad_account_id, page_id } = req.body;

    if (!access_token || !ad_account_id) {
      return res.status(400).json({ error: 'Access token and ad account ID are required' });
    }

    const config = JSON.stringify({
      access_token,
      ad_account_id,
      page_id: page_id || '',
    });

    const existing = await pool.query(
      "SELECT id FROM integrations WHERE provider = 'meta'"
    );

    if (existing.rows.length > 0) {
      await pool.query(
        "UPDATE integrations SET config = $1, updated_at = NOW() WHERE provider = 'meta'",
        [config]
      );
    } else {
      await pool.query(
        "INSERT INTO integrations (provider, config, created_at, updated_at) VALUES ('meta', $1, NOW(), NOW())",
        [config]
      );
    }

    res.json({ message: 'Meta credentials saved', configured: true });
  } catch (err) {
    console.error('Meta connect error:', err);
    res.status(500).json({ error: 'Failed to save Meta credentials' });
  }
});

module.exports = router;
