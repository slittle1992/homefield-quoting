const express = require('express');
const axios = require('axios');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/properties/stats - return counts by campaign_status, lead_source, and totals
router.get('/stats', authenticate, async (req, res) => {
  try {
    const statusCounts = await pool.query(`
      SELECT campaign_status, COUNT(*)::INTEGER as count
      FROM properties
      GROUP BY campaign_status
    `);

    const sourceCounts = await pool.query(`
      SELECT lead_source, COUNT(*)::INTEGER as count
      FROM properties
      GROUP BY lead_source
    `);

    const totals = await pool.query(`
      SELECT
        COUNT(*)::INTEGER as total,
        COUNT(*) FILTER (WHERE do_not_drop = true)::INTEGER as do_not_drop,
        COUNT(*) FILTER (WHERE converted_at IS NOT NULL)::INTEGER as converted,
        COUNT(*) FILTER (WHERE fb_exported_at IS NOT NULL)::INTEGER as fb_exported
      FROM properties
    `);

    res.json({
      by_status: statusCounts.rows,
      by_source: sourceCounts.rows,
      totals: totals.rows[0],
    });
  } catch (err) {
    console.error('Get property stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/properties/map - return properties within bounding box for map pins
router.get('/map', authenticate, async (req, res) => {
  try {
    const { sw_lat, sw_lng, ne_lat, ne_lng } = req.query;

    if (!sw_lat || !sw_lng || !ne_lat || !ne_lng) {
      return res.status(400).json({ error: 'Bounding box parameters required: sw_lat, sw_lng, ne_lat, ne_lng' });
    }

    const result = await pool.query(`
      SELECT id, latitude, longitude, campaign_status, campaign_drops_completed,
             campaign_total_drops, lead_source, do_not_drop
      FROM properties
      WHERE geom IS NOT NULL
        AND ST_Intersects(
          geom,
          ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography
        )
    `, [sw_lng, sw_lat, ne_lng, ne_lat]);

    res.json({ properties: result.rows });
  } catch (err) {
    console.error('Get map properties error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/properties/reverse-geocode - reverse geocode lat/lng via Mapbox
router.post('/reverse-geocode', authenticate, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Mapbox access token not configured' });
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${token}&types=address`;
    const response = await axios.get(url);

    if (!response.data.features || response.data.features.length === 0) {
      return res.status(404).json({ error: 'No address found for these coordinates' });
    }

    const feature = response.data.features[0];
    const context = feature.context || [];

    const getContext = (type) => {
      const item = context.find((c) => c.id.startsWith(type));
      return item ? item.text : null;
    };

    res.json({
      address: feature.place_name,
      street: feature.text + (feature.address ? ` ${feature.address}` : ''),
      city: getContext('place'),
      state: getContext('region'),
      zip: getContext('postcode'),
      latitude,
      longitude,
    });
  } catch (err) {
    console.error('Reverse geocode error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/properties - list with filters and pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      lead_source,
      campaign_status,
      subdivision,
      zip,
      do_not_drop,
      sw_lat, sw_lng, ne_lat, ne_lng,
      search,
      limit = 50,
      offset = 0,
    } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (lead_source) {
      conditions.push(`lead_source = $${paramIndex++}`);
      params.push(lead_source);
    }

    if (campaign_status) {
      conditions.push(`campaign_status = $${paramIndex++}`);
      params.push(campaign_status);
    }

    if (subdivision) {
      conditions.push(`subdivision ILIKE $${paramIndex++}`);
      params.push(`%${subdivision}%`);
    }

    if (zip) {
      conditions.push(`zip = $${paramIndex++}`);
      params.push(zip);
    }

    if (do_not_drop !== undefined) {
      conditions.push(`do_not_drop = $${paramIndex++}`);
      params.push(do_not_drop === 'true');
    }

    if (sw_lat && sw_lng && ne_lat && ne_lng) {
      conditions.push(`geom IS NOT NULL AND ST_Intersects(geom, ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326)::geography)`);
      params.push(sw_lng, sw_lat, ne_lng, ne_lat);
      paramIndex += 4;
    }

    if (search) {
      conditions.push(`(address ILIKE $${paramIndex} OR owner_name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*)::INTEGER as count FROM properties ${whereClause}`,
      params
    );

    const dataParams = [...params, parseInt(limit), parseInt(offset)];
    const result = await pool.query(
      `SELECT * FROM properties ${whereClause}
       ORDER BY updated_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams
    );

    res.json({
      properties: result.rows,
      total: countResult.rows[0].count,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error('List properties error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/properties/:id - get single property
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM properties WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Get drop history
    const drops = await pool.query(
      'SELECT * FROM drop_queue WHERE property_id = $1 ORDER BY drop_number',
      [req.params.id]
    );

    // Get mailer history
    const mailers = await pool.query(
      'SELECT * FROM mailer_queue WHERE property_id = $1 ORDER BY mailer_number',
      [req.params.id]
    );

    // Get conversions
    const conversions = await pool.query(
      'SELECT * FROM conversions WHERE property_id = $1',
      [req.params.id]
    );

    res.json({
      property: result.rows[0],
      drops: drops.rows,
      mailers: mailers.rows,
      conversions: conversions.rows,
    });
  } catch (err) {
    console.error('Get property error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/properties - create property
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      address, city, state, zip, latitude, longitude,
      owner_name, property_value, year_built, subdivision,
      pool_type, lead_source, mls_listing_id, mls_status,
      campaign_total_drops,
    } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const geomExpr = (latitude != null && longitude != null)
      ? `ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography`
      : 'NULL';

    // Determine initial campaign state
    let campaignStatus = 'not_started';
    let campaignNextDropDate = null;

    if (lead_source === 'manual_spotted') {
      campaignStatus = 'flyer_in_progress';
      campaignNextDropDate = new Date().toISOString().split('T')[0];
    }

    const result = await pool.query(`
      INSERT INTO properties (
        address, city, state, zip, latitude, longitude, geom,
        owner_name, property_value, year_built, subdivision,
        pool_type, lead_source, mls_listing_id, mls_status,
        campaign_total_drops, campaign_status, campaign_next_drop_date
      ) VALUES (
        $1, $2, $3, $4, $5, $6, ${geomExpr},
        $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING *
    `, [
      address, city, state || 'TX', zip,
      latitude || null, longitude || null,
      owner_name || null, property_value || null,
      year_built || null, subdivision || null,
      pool_type || null, lead_source || null,
      mls_listing_id || null, mls_status || null,
      campaign_total_drops || 4, campaignStatus, campaignNextDropDate,
    ]);

    const property = result.rows[0];

    // If manual_spotted, auto-start campaign by creating first drop queue entry
    if (lead_source === 'manual_spotted') {
      await pool.query(`
        INSERT INTO drop_queue (property_id, drop_number, scheduled_date, priority, status)
        VALUES ($1, 1, $2, 10, 'queued')
      `, [property.id, campaignNextDropDate]);
    }

    res.status(201).json({ property });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Property with this address and zip already exists' });
    }
    console.error('Create property error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/properties/:id - update property
router.put('/:id', authenticate, async (req, res) => {
  try {
    const {
      address, city, state, zip, latitude, longitude,
      owner_name, property_value, year_built, subdivision,
      pool_type, lead_source, mls_listing_id, mls_status, mls_status_date,
      do_not_drop, campaign_total_drops, campaign_status,
      campaign_next_drop_date,
    } = req.body;

    // Build dynamic update
    const fields = [];
    const params = [];
    let paramIndex = 1;

    const addField = (name, value) => {
      if (value !== undefined) {
        fields.push(`${name} = $${paramIndex++}`);
        params.push(value);
      }
    };

    addField('address', address);
    addField('city', city);
    addField('state', state);
    addField('zip', zip);
    addField('latitude', latitude);
    addField('longitude', longitude);
    addField('owner_name', owner_name);
    addField('property_value', property_value);
    addField('year_built', year_built);
    addField('subdivision', subdivision);
    addField('pool_type', pool_type);
    addField('lead_source', lead_source);
    addField('mls_listing_id', mls_listing_id);
    addField('mls_status', mls_status);
    addField('mls_status_date', mls_status_date);
    addField('do_not_drop', do_not_drop);
    addField('campaign_total_drops', campaign_total_drops);
    addField('campaign_status', campaign_status);
    addField('campaign_next_drop_date', campaign_next_drop_date);

    // Update geom if lat/lng provided
    if (latitude !== undefined && longitude !== undefined && latitude != null && longitude != null) {
      fields.push(`geom = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography`);
      params.push(longitude, latitude);
      paramIndex += 2;
    }

    fields.push(`updated_at = NOW()`);

    if (fields.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE properties SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json({ property: result.rows[0] });
  } catch (err) {
    console.error('Update property error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/properties/:id
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    // Delete related records first
    await pool.query('DELETE FROM fb_export_properties WHERE property_id = $1', [req.params.id]);
    await pool.query('DELETE FROM conversions WHERE property_id = $1', [req.params.id]);
    await pool.query('DELETE FROM mailer_queue WHERE property_id = $1', [req.params.id]);
    await pool.query('DELETE FROM drop_queue WHERE property_id = $1', [req.params.id]);

    const result = await pool.query(
      'DELETE FROM properties WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json({ message: 'Property deleted', id: parseInt(req.params.id) });
  } catch (err) {
    console.error('Delete property error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/properties/:id/do-not-drop - toggle do_not_drop flag
router.post('/:id/do-not-drop', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE properties SET do_not_drop = NOT do_not_drop, updated_at = NOW()
       WHERE id = $1 RETURNING id, do_not_drop`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json({ property: result.rows[0] });
  } catch (err) {
    console.error('Toggle do_not_drop error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/properties/:id/convert - mark as converted
router.post('/:id/convert', authenticate, async (req, res) => {
  try {
    const { customer_name, service_type, revenue, conversion_channel } = req.body;

    if (!conversion_channel) {
      return res.status(400).json({ error: 'conversion_channel is required' });
    }

    // Update property
    const propResult = await pool.query(
      `UPDATE properties
       SET converted_at = NOW(), conversion_channel = $1, campaign_status = 'converted', updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [conversion_channel, req.params.id]
    );

    if (propResult.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Find most recent delivered drop for this property
    const lastDrop = await pool.query(
      `SELECT id FROM drop_queue WHERE property_id = $1 AND status = 'delivered' ORDER BY delivered_at DESC LIMIT 1`,
      [req.params.id]
    );

    // Find most recent delivered mailer for this property
    const lastMailer = await pool.query(
      `SELECT id FROM mailer_queue WHERE property_id = $1 AND status IN ('sent', 'delivered') ORDER BY sent_at DESC LIMIT 1`,
      [req.params.id]
    );

    // Insert conversion record
    const convResult = await pool.query(
      `INSERT INTO conversions (property_id, drop_queue_id, mailer_queue_id, customer_name, service_type, revenue, conversion_channel)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        req.params.id,
        lastDrop.rows.length > 0 ? lastDrop.rows[0].id : null,
        lastMailer.rows.length > 0 ? lastMailer.rows[0].id : null,
        customer_name || null,
        service_type || null,
        revenue || null,
        conversion_channel,
      ]
    );

    res.json({
      property: propResult.rows[0],
      conversion: convResult.rows[0],
    });
  } catch (err) {
    console.error('Convert property error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
