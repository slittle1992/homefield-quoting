const dayjs = require('dayjs');
const config = require('../config');
const { createLogger } = require('../utils/logger');

const log = createLogger('flyers');

let pool = null;

function getPool() {
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: config.poolDrop.databaseUrl });
  }
  return pool;
}

async function collectLive() {
  const db = getPool();
  const today = dayjs().format('YYYY-MM-DD');
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  const weekStart = dayjs().startOf('week').format('YYYY-MM-DD');
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');

  // Yesterday's deliveries
  const yesterdayRes = await db.query(
    `SELECT dq.*, p.subdivision, p.zip, p.address
     FROM drop_queue dq
     JOIN properties p ON dq.property_id = p.id
     WHERE dq.status = 'delivered'
       AND dq.delivered_at::date = $1`,
    [yesterday]
  );

  const yesterdaySubdivisions = [...new Set(yesterdayRes.rows.map((r) => r.subdivision).filter(Boolean))];

  // This week's deliveries
  const weekRes = await db.query(
    `SELECT dq.*, p.subdivision, p.zip
     FROM drop_queue dq
     JOIN properties p ON dq.property_id = p.id
     WHERE dq.status = 'delivered'
       AND dq.delivered_at::date >= $1
       AND dq.delivered_at::date <= $2`,
    [weekStart, today]
  );

  const weekSubdivisions = [...new Set(weekRes.rows.map((r) => r.subdivision).filter(Boolean))];

  // This month's count
  const monthRes = await db.query(
    `SELECT COUNT(*) as count
     FROM drop_queue
     WHERE status = 'delivered'
       AND delivered_at::date >= $1
       AND delivered_at::date <= $2`,
    [monthStart, today]
  );

  // Conversion tracking — join with conversions table
  const conversionRes = await db.query(
    `SELECT
       COUNT(DISTINCT p.id) as flyered_properties,
       COUNT(DISTINCT c.id) as conversions,
       SUM(c.revenue) as total_revenue
     FROM properties p
     LEFT JOIN conversions c ON c.property_id = p.id
     WHERE p.campaign_drops_completed > 0`
  );

  // Top neighborhoods by deliveries + conversions
  const topNeighborhoodsRes = await db.query(
    `SELECT
       p.subdivision as name,
       COUNT(DISTINCT dq.id) as flyers_dropped,
       COUNT(DISTINCT c.id) as leads_generated
     FROM properties p
     JOIN drop_queue dq ON dq.property_id = p.id AND dq.status = 'delivered'
     LEFT JOIN conversions c ON c.property_id = p.id
     WHERE p.subdivision IS NOT NULL
     GROUP BY p.subdivision
     ORDER BY leads_generated DESC, flyers_dropped DESC
     LIMIT 10`
  );

  const conv = conversionRes.rows[0] || {};
  const flyeredCount = parseInt(conv.flyered_properties) || 0;
  const conversionCount = parseInt(conv.conversions) || 0;

  return {
    yesterday: {
      count: yesterdayRes.rows.length,
      neighborhoods: yesterdaySubdivisions,
    },
    thisWeek: {
      count: weekRes.rows.length,
      neighborhoods: weekSubdivisions,
    },
    thisMonth: {
      count: parseInt(monthRes.rows[0]?.count) || 0,
    },
    conversionTracking: {
      flyeredNeighborhoods: flyeredCount,
      leadsFromFlyeredAreas: conversionCount,
      estimatedConversionRate: flyeredCount > 0 ? Math.round((conversionCount / flyeredCount) * 10000) / 100 : 0,
    },
    topNeighborhoods: topNeighborhoodsRes.rows.map((r) => ({
      name: r.name,
      flyersDropped: parseInt(r.flyers_dropped),
      leadsGenerated: parseInt(r.leads_generated),
    })),
  };
}

function getMockData() {
  return {
    yesterday: {
      count: 45,
      neighborhoods: ['China Spring Estates', 'Hewitt Hills', 'Woodway Trails'],
    },
    thisWeek: {
      count: 180,
      neighborhoods: ['China Spring Estates', 'Hewitt Hills', 'Woodway Trails', 'Bosque Bluffs', 'Lake Shore Estates'],
    },
    thisMonth: {
      count: 620,
    },
    conversionTracking: {
      flyeredNeighborhoods: 42,
      leadsFromFlyeredAreas: 6,
      estimatedConversionRate: 14.29,
    },
    topNeighborhoods: [
      { name: 'China Spring Estates', flyersDropped: 120, leadsGenerated: 3 },
      { name: 'Hewitt Hills', flyersDropped: 95, leadsGenerated: 2 },
      { name: 'Woodway Trails', flyersDropped: 80, leadsGenerated: 1 },
      { name: 'Bosque Bluffs', flyersDropped: 65, leadsGenerated: 0 },
    ],
    _mock: true,
  };
}

async function collect() {
  log.info('Collecting PoolDrop flyer data...');

  if (!config.poolDrop.databaseUrl) {
    log.warn('PoolDrop database not configured, returning mock data');
    return getMockData();
  }

  try {
    return await collectLive();
  } catch (err) {
    log.error('PoolDrop collection failed, returning mock data', { error: err.message });
    return { ...getMockData(), _error: err.message };
  }
}

async function shutdown() {
  if (pool) await pool.end();
}

module.exports = { collect, shutdown };
