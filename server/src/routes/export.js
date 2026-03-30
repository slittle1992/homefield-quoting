const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

function parseOwnerName(ownerName) {
  if (!ownerName) return { firstName: '', lastName: '' };

  const cleaned = ownerName.trim();

  // Handle "LAST, FIRST" format
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',').map((p) => p.trim());
    return {
      firstName: parts[1] || '',
      lastName: parts[0] || '',
    };
  }

  // Handle "FIRST LAST" format
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: '', lastName: parts[0] };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function toTitleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// POST /api/export/facebook - generate Facebook Custom Audience CSV
router.post('/facebook', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const {
      campaign_status,
      lead_source,
      subdivision,
      date_range,
      exclude_already_exported,
    } = req.body;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Filter by campaign_status (can be array)
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

    if (exclude_already_exported) {
      conditions.push('fb_exported_at IS NULL');
    }

    // Must have an address
    conditions.push('address IS NOT NULL');

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT id, owner_name, address, city, state, zip FROM properties ${whereClause}`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No properties match the filter criteria' });
    }

    // Generate CSV
    const csvRows = ['fn,ln,st,ct,zip,country'];

    for (const row of result.rows) {
      const { firstName, lastName } = parseOwnerName(row.owner_name);
      const fn = toTitleCase(firstName).replace(/,/g, '');
      const ln = toTitleCase(lastName).replace(/,/g, '');
      const st = (row.address || '').replace(/,/g, '');
      const ct = (row.city || '').replace(/,/g, '');
      const zipCode = (row.zip || '').replace(/,/g, '');
      csvRows.push(`${fn},${ln},${st},${ct},${zipCode},US`);
    }

    const csvContent = csvRows.join('\n');
    const filename = `fb_audience_${new Date().toISOString().split('T')[0]}.csv`;

    // Log the export
    const filterCriteria = { campaign_status, lead_source, subdivision, date_range, exclude_already_exported };
    const exportLog = await pool.query(
      `INSERT INTO fb_export_log (total_addresses, filter_criteria, filename)
       VALUES ($1, $2, $3) RETURNING id`,
      [result.rows.length, JSON.stringify(filterCriteria), filename]
    );

    const exportId = exportLog.rows[0].id;

    // Log individual properties and update fb_exported_at
    const propertyIds = result.rows.map((r) => r.id);
    for (const propId of propertyIds) {
      await pool.query(
        'INSERT INTO fb_export_properties (export_id, property_id) VALUES ($1, $2)',
        [exportId, propId]
      );
    }

    // Mark properties as exported
    await pool.query(
      `UPDATE properties SET fb_exported_at = NOW(), updated_at = NOW()
       WHERE id = ANY($1)`,
      [propertyIds]
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Facebook export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/export/converted - export converted customers CSV for lookalike audience
router.post('/converted', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.owner_name, p.address, p.city, p.state, p.zip,
             c.customer_name, c.service_type, c.revenue, c.conversion_channel, c.converted_at
      FROM properties p
      JOIN conversions c ON c.property_id = p.id
      ORDER BY c.converted_at DESC
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No converted customers found' });
    }

    const csvRows = ['fn,ln,st,ct,zip,country'];

    for (const row of result.rows) {
      const nameSource = row.customer_name || row.owner_name;
      const { firstName, lastName } = parseOwnerName(nameSource);
      const fn = toTitleCase(firstName).replace(/,/g, '');
      const ln = toTitleCase(lastName).replace(/,/g, '');
      const st = (row.address || '').replace(/,/g, '');
      const ct = (row.city || '').replace(/,/g, '');
      const zipCode = (row.zip || '').replace(/,/g, '');
      csvRows.push(`${fn},${ln},${st},${ct},${zipCode},US`);
    }

    const csvContent = csvRows.join('\n');
    const filename = `converted_lookalike_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Converted export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper: build filter conditions from query params (GET requests)
function buildFilterFromQuery(query) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (query.campaign_statuses) {
    const statuses = query.campaign_statuses.split(',').filter(Boolean);
    if (statuses.length > 0) {
      const placeholders = statuses.map(() => `$${paramIndex++}`);
      conditions.push(`campaign_status IN (${placeholders.join(', ')})`);
      params.push(...statuses);
    }
  }

  if (query.lead_source) {
    conditions.push(`lead_source = $${paramIndex++}`);
    params.push(query.lead_source);
  }

  if (query.subdivision) {
    conditions.push(`subdivision ILIKE $${paramIndex++}`);
    params.push(`%${query.subdivision}%`);
  }

  if (query.date_from) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(query.date_from);
  }

  if (query.date_to) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(query.date_to);
  }

  if (query.exclude_exported === 'true' || query.exclude_exported === true) {
    conditions.push('fb_exported_at IS NULL');
  }

  conditions.push('address IS NOT NULL');

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
}

// GET /api/export/preview-count - count matching properties based on query filters
router.get('/preview-count', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { whereClause, params } = buildFilterFromQuery(req.query);
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM properties ${whereClause}`,
      params
    );
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    console.error('Preview count error:', err);
    res.status(500).json({ error: 'Failed to get preview count' });
  }
});

// GET /api/export/history - list past exports
router.get('/history', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, total_addresses as record_count, filter_criteria as filters,
              filename, created_at, 'Facebook' as export_type
       FROM fb_export_log
       ORDER BY created_at DESC
       LIMIT 50`
    );
    res.json({ exports: result.rows });
  } catch (err) {
    console.error('Export history error:', err);
    res.status(500).json({ error: 'Failed to get export history' });
  }
});

// GET /api/export/facebook - same as POST but using query params (for file download)
router.get('/facebook', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { whereClause, params } = buildFilterFromQuery(req.query);

    const result = await pool.query(
      `SELECT id, owner_name, address, city, state, zip FROM properties ${whereClause}`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No properties match the filter criteria' });
    }

    const csvRows = ['fn,ln,st,ct,zip,country'];

    for (const row of result.rows) {
      const { firstName, lastName } = parseOwnerName(row.owner_name);
      const fn = toTitleCase(firstName).replace(/,/g, '');
      const ln = toTitleCase(lastName).replace(/,/g, '');
      const st = (row.address || '').replace(/,/g, '');
      const ct = (row.city || '').replace(/,/g, '');
      const zipCode = (row.zip || '').replace(/,/g, '');
      csvRows.push(`${fn},${ln},${st},${ct},${zipCode},US`);
    }

    const csvContent = csvRows.join('\n');
    const filename = `fb_audience_${new Date().toISOString().split('T')[0]}.csv`;

    // Log the export
    const filterCriteria = { ...req.query };
    const exportLog = await pool.query(
      `INSERT INTO fb_export_log (total_addresses, filter_criteria, filename)
       VALUES ($1, $2, $3) RETURNING id`,
      [result.rows.length, JSON.stringify(filterCriteria), filename]
    );

    const exportId = exportLog.rows[0].id;

    const propertyIds = result.rows.map((r) => r.id);
    for (const propId of propertyIds) {
      await pool.query(
        'INSERT INTO fb_export_properties (export_id, property_id) VALUES ($1, $2)',
        [exportId, propId]
      );
    }

    await pool.query(
      `UPDATE properties SET fb_exported_at = NOW(), updated_at = NOW()
       WHERE id = ANY($1)`,
      [propertyIds]
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Facebook GET export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/export/converted - same as POST but as GET for file download
router.get('/converted', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.owner_name, p.address, p.city, p.state, p.zip,
             c.customer_name, c.service_type, c.revenue, c.conversion_channel, c.converted_at
      FROM properties p
      JOIN conversions c ON c.property_id = p.id
      ORDER BY c.converted_at DESC
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No converted customers found' });
    }

    const csvRows = ['fn,ln,st,ct,zip,country'];

    for (const row of result.rows) {
      const nameSource = row.customer_name || row.owner_name;
      const { firstName, lastName } = parseOwnerName(nameSource);
      const fn = toTitleCase(firstName).replace(/,/g, '');
      const ln = toTitleCase(lastName).replace(/,/g, '');
      const st = (row.address || '').replace(/,/g, '');
      const ct = (row.city || '').replace(/,/g, '');
      const zipCode = (row.zip || '').replace(/,/g, '');
      csvRows.push(`${fn},${ln},${st},${ct},${zipCode},US`);
    }

    const csvContent = csvRows.join('\n');
    const filename = `converted_lookalike_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Converted GET export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
