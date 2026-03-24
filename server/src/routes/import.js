const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

const POOL_KEYWORDS = ['POOL', 'GUNITE', 'VINYL', 'ABOVE GROUND'];

function extractPoolType(description) {
  const upper = description.toUpperCase();
  if (upper.includes('GUNITE')) return 'gunite';
  if (upper.includes('VINYL')) return 'vinyl';
  if (upper.includes('ABOVE GROUND')) return 'above_ground';
  if (upper.includes('POOL')) return 'pool';
  return 'unknown';
}

function extractSubdivision(legalDesc) {
  if (!legalDesc) return null;
  // Common patterns: "SUBDIVISION NAME BLK 1 LOT 2" or "LOT 5 BLK A SUBDIVISION NAME"
  // Try to extract text before BLK/LOT/BLOCK
  const match = legalDesc.match(/^(.+?)\s+(?:BLK|BLOCK|LOT|SEC|SECTION|PH|PHASE)\b/i);
  if (match) {
    return match[1].trim();
  }
  // Try pattern where subdivision is after LOT/BLK info
  const match2 = legalDesc.match(/(?:LOT\s+\S+\s+(?:BLK|BLOCK)\s+\S+\s+)(.+)/i);
  if (match2) {
    return match2[1].trim();
  }
  return null;
}

function findColumn(headers, ...candidates) {
  const headerLower = headers.map((h) => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const idx = headerLower.indexOf(candidate.toLowerCase());
    if (idx !== -1) return idx;
  }
  // Partial match
  for (const candidate of candidates) {
    const idx = headerLower.findIndex((h) => h.includes(candidate.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

// POST /api/import/wcad - import WCAD CSV
router.post('/wcad', authenticate, requireRole('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const csvContent = req.file.buffer.toString('utf-8');

    const records = await new Promise((resolve, reject) => {
      const rows = [];
      const parser = parse(csvContent, {
        columns: false,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      });

      parser.on('data', (row) => rows.push(row));
      parser.on('error', reject);
      parser.on('end', () => resolve(rows));
    });

    if (records.length < 2) {
      return res.status(400).json({ error: 'CSV file must have a header row and at least one data row' });
    }

    const headers = records[0];
    const dataRows = records.slice(1);

    // Map columns
    const colMap = {
      propId: findColumn(headers, 'prop_id', 'property_id', 'account'),
      ownerName: findColumn(headers, 'owner_name', 'owner', 'name'),
      address: findColumn(headers, 'situs_address', 'address', 'situs_addr', 'street'),
      city: findColumn(headers, 'situs_city', 'city'),
      zip: findColumn(headers, 'situs_zip', 'zip', 'zipcode', 'zip_code'),
      legalDesc: findColumn(headers, 'legal_desc', 'legal_description', 'legal'),
      marketValue: findColumn(headers, 'market_value', 'total_value', 'appraised_value', 'value'),
      yearBuilt: findColumn(headers, 'year_built', 'yr_built', 'year'),
      imprDesc: findColumn(headers, 'improvement_type', 'impr_desc', 'improvement_desc', 'improvement', 'description', 'impr_type'),
    };

    if (colMap.address === -1) {
      return res.status(400).json({ error: 'Could not find address column in CSV' });
    }

    let totalRows = 0;
    let poolPropertiesFound = 0;
    let newImported = 0;
    let alreadyExisted = 0;
    const errors = [];

    for (const row of dataRows) {
      totalRows++;

      // Check if row has pool-related improvement
      const imprDesc = colMap.imprDesc !== -1 ? (row[colMap.imprDesc] || '') : '';
      const hasPool = POOL_KEYWORDS.some((keyword) => imprDesc.toUpperCase().includes(keyword));

      if (!hasPool && colMap.imprDesc !== -1) {
        continue; // Skip non-pool properties
      }

      // If no imprDesc column found, import all rows
      poolPropertiesFound++;

      const address = row[colMap.address];
      if (!address || !address.trim()) {
        errors.push(`Row ${totalRows + 1}: Missing address`);
        continue;
      }

      const zip = colMap.zip !== -1 ? (row[colMap.zip] || null) : null;
      const city = colMap.city !== -1 ? (row[colMap.city] || null) : null;
      const ownerName = colMap.ownerName !== -1 ? (row[colMap.ownerName] || null) : null;
      const marketValue = colMap.marketValue !== -1 ? parseInt(row[colMap.marketValue]?.replace(/[,$]/g, '')) || null : null;
      const yearBuilt = colMap.yearBuilt !== -1 ? parseInt(row[colMap.yearBuilt]) || null : null;
      const legalDesc = colMap.legalDesc !== -1 ? (row[colMap.legalDesc] || null) : null;
      const poolType = colMap.imprDesc !== -1 ? extractPoolType(imprDesc) : null;
      const subdivision = extractSubdivision(legalDesc);

      try {
        const result = await pool.query(`
          INSERT INTO properties (address, city, state, zip, owner_name, property_value, year_built, subdivision, pool_type, lead_source)
          VALUES ($1, $2, 'TX', $3, $4, $5, $6, $7, $8, 'wcad')
          ON CONFLICT (address, zip) DO UPDATE SET
            owner_name = COALESCE(EXCLUDED.owner_name, properties.owner_name),
            property_value = COALESCE(EXCLUDED.property_value, properties.property_value),
            year_built = COALESCE(EXCLUDED.year_built, properties.year_built),
            subdivision = COALESCE(EXCLUDED.subdivision, properties.subdivision),
            pool_type = COALESCE(EXCLUDED.pool_type, properties.pool_type),
            updated_at = NOW()
          RETURNING (xmax = 0) as is_new
        `, [address.trim(), city, zip, ownerName, marketValue, yearBuilt, subdivision, poolType]);

        if (result.rows[0].is_new) {
          newImported++;
        } else {
          alreadyExisted++;
        }
      } catch (rowErr) {
        errors.push(`Row ${totalRows + 1}: ${rowErr.message}`);
      }
    }

    res.json({
      total_rows: totalRows,
      pool_properties_found: poolPropertiesFound,
      new_imported: newImported,
      already_existed: alreadyExisted,
      errors: errors.length > 0 ? errors : null,
    });
  } catch (err) {
    console.error('WCAD import error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
