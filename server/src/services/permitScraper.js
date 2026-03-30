const axios = require('axios');
const pool = require('../config/database');

/**
 * County configuration registry.
 * Each county has a name, base URL, search URL pattern, keywords, and a parser.
 * Parsers return an array of permit objects: { address, owner_name, permit_number, permit_date, permit_type }
 */
const PERMIT_KEYWORDS = ['pool', 'spa', 'swimming', 'aquatic'];

/**
 * Default HTML table parser — extracts rows from <table> elements using regex.
 * Looks for columns that match expected fields by header text.
 */
function parseHtmlTable(html) {
  const permits = [];

  // Extract all tables
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableContent = tableMatch[1];

    // Extract header row to determine column mapping
    const headerRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    const headers = [];
    let headerMatch;
    while ((headerMatch = headerRegex.exec(tableContent)) !== null) {
      headers.push(headerMatch[1].replace(/<[^>]+>/g, '').trim().toLowerCase());
    }

    if (headers.length === 0) continue;

    // Map columns by header text
    const colMap = {
      address: headers.findIndex((h) => /address|location|site|situs/.test(h)),
      owner_name: headers.findIndex((h) => /owner|applicant|name/.test(h)),
      permit_number: headers.findIndex((h) => /permit.*(?:no|num|#|id)|number/.test(h)),
      permit_date: headers.findIndex((h) => /date|issued|filed/.test(h)),
      permit_type: headers.findIndex((h) => /type|desc|description|category|work/.test(h)),
    };

    // Extract data rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    let isFirstRow = true;

    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      // Skip header row
      if (isFirstRow) {
        isFirstRow = false;
        if (/<th/i.test(rowMatch[1])) continue;
      }

      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
      }

      if (cells.length === 0) continue;

      // Check if this row matches pool-related keywords
      const rowText = cells.join(' ').toLowerCase();
      const isPoolRelated = PERMIT_KEYWORDS.some((kw) => rowText.includes(kw));
      if (!isPoolRelated) continue;

      const permit = {
        address: colMap.address >= 0 ? cells[colMap.address] || null : null,
        owner_name: colMap.owner_name >= 0 ? cells[colMap.owner_name] || null : null,
        permit_number: colMap.permit_number >= 0 ? cells[colMap.permit_number] || null : null,
        permit_date: colMap.permit_date >= 0 ? cells[colMap.permit_date] || null : null,
        permit_type: colMap.permit_type >= 0 ? cells[colMap.permit_type] || null : null,
      };

      // Only include if we have at least an address
      if (permit.address) {
        permits.push(permit);
      }
    }
  }

  return permits;
}

/**
 * JSON response parser — expects an array of permit objects or a wrapper with a results key.
 */
function parseJsonResponse(data) {
  const permits = [];

  // Handle wrapper objects with common result keys
  let items = data;
  if (!Array.isArray(data)) {
    const resultKeys = ['results', 'permits', 'records', 'data', 'items'];
    for (const key of resultKeys) {
      if (Array.isArray(data[key])) {
        items = data[key];
        break;
      }
    }
  }

  if (!Array.isArray(items)) return permits;

  for (const item of items) {
    const rowText = JSON.stringify(item).toLowerCase();
    const isPoolRelated = PERMIT_KEYWORDS.some((kw) => rowText.includes(kw));
    if (!isPoolRelated) continue;

    // Flexible field mapping — try multiple possible key names
    const permit = {
      address: item.address || item.site_address || item.location || item.situs_address || null,
      owner_name: item.owner_name || item.owner || item.applicant || item.applicant_name || null,
      permit_number: item.permit_number || item.permit_no || item.permit_id || item.number || null,
      permit_date: item.permit_date || item.issue_date || item.issued_date || item.date || null,
      permit_type: item.permit_type || item.type || item.description || item.work_type || null,
    };

    if (permit.address) {
      permits.push(permit);
    }
  }

  return permits;
}

/**
 * County configurations — pluggable system.
 */
const COUNTY_CONFIGS = {
  williamson: {
    name: 'Williamson County',
    baseUrl: process.env.WILLIAMSON_PERMIT_URL || 'https://permits.wilco.org',
    searchUrl: '/api/permits/search',
    keywords: PERMIT_KEYWORDS,
    parser: null, // auto-detect based on content type
  },
};

/**
 * Load county configs from environment and database.
 * Environment counties override built-in defaults.
 */
function getCountyConfig(county) {
  const key = county.toLowerCase().replace(/\s+/g, '_');
  return COUNTY_CONFIGS[key] || null;
}

/**
 * Get all registered county keys.
 */
function getRegisteredCounties() {
  return Object.keys(COUNTY_CONFIGS);
}

/**
 * Scrape permits for a single county.
 * Returns an array of permit objects.
 */
async function scrapePermits(county) {
  const config = getCountyConfig(county);
  if (!config) {
    throw new Error(`No configuration found for county: ${county}`);
  }

  const url = config.baseUrl + config.searchUrl;
  const keywords = config.keywords || PERMIT_KEYWORDS;

  let allPermits = [];

  for (const keyword of keywords) {
    try {
      const response = await axios.get(url, {
        params: { q: keyword, type: 'permit' },
        timeout: 30000,
        headers: {
          'User-Agent': 'PoolDrop-PermitScraper/1.0',
          Accept: 'application/json, text/html',
        },
        // Don't throw on non-2xx so we can handle gracefully
        validateStatus: (status) => status < 500,
      });

      if (response.status === 404 || response.status >= 400) {
        console.warn(`Permit scraper: ${config.name} returned ${response.status} for keyword "${keyword}"`);
        continue;
      }

      let permits = [];
      const contentType = response.headers['content-type'] || '';

      if (config.parser) {
        // Use custom parser if provided
        permits = config.parser(response.data, keyword);
      } else if (contentType.includes('application/json') || typeof response.data === 'object') {
        permits = parseJsonResponse(response.data);
      } else {
        // Assume HTML
        permits = parseHtmlTable(typeof response.data === 'string' ? response.data : String(response.data));
      }

      allPermits = allPermits.concat(permits);
    } catch (err) {
      console.error(`Permit scraper: error fetching ${config.name} for keyword "${keyword}":`, err.message);
    }
  }

  // Deduplicate by permit_number or address
  const seen = new Set();
  const deduped = [];
  for (const permit of allPermits) {
    const key = permit.permit_number || permit.address;
    if (key && !seen.has(key)) {
      seen.add(key);
      deduped.push(permit);
    }
  }

  return deduped;
}

/**
 * Process scraped permit results: insert new properties and log to permit_imports.
 */
async function processPermitResults(county, permits) {
  let newCount = 0;
  let duplicateCount = 0;
  let totalProcessed = 0;

  for (const permit of permits) {
    totalProcessed++;

    if (!permit.address || !permit.address.trim()) {
      continue;
    }

    const address = permit.address.trim();

    try {
      // Check if property already exists
      const existing = await pool.query(
        'SELECT id FROM properties WHERE address = $1',
        [address]
      );

      let propertyId;

      if (existing.rows.length > 0) {
        propertyId = existing.rows[0].id;
        duplicateCount++;
      } else {
        // Create new property
        const insertResult = await pool.query(`
          INSERT INTO properties (address, owner_name, lead_source, campaign_status)
          VALUES ($1, $2, 'permit', 'not_started')
          RETURNING id
        `, [address, permit.owner_name || null]);

        propertyId = insertResult.rows[0].id;
        newCount++;
      }

      // Log to permit_imports
      await pool.query(`
        INSERT INTO permit_imports (
          property_id, county, permit_number, permit_date, permit_type, address, owner_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (county, permit_number) DO NOTHING
      `, [
        propertyId,
        county,
        permit.permit_number || null,
        permit.permit_date || null,
        permit.permit_type || null,
        address,
        permit.owner_name || null,
      ]);
    } catch (err) {
      console.error(`Permit scraper: error processing permit for "${address}":`, err.message);
    }
  }

  return { new_count: newCount, duplicate_count: duplicateCount, total_processed: totalProcessed };
}

module.exports = {
  scrapePermits,
  processPermitResults,
  getCountyConfig,
  getRegisteredCounties,
  parseHtmlTable,
  parseJsonResponse,
  PERMIT_KEYWORDS,
  COUNTY_CONFIGS,
};
