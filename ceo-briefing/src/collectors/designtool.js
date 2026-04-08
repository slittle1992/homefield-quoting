const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const config = require('../config');
const { createLogger } = require('../utils/logger');

const log = createLogger('designtool');

function readDesignFiles() {
  const designPath = config.designTool.dataPath;

  if (!fs.existsSync(designPath)) {
    log.warn(`Design data path does not exist: ${designPath}`);
    return [];
  }

  const files = fs.readdirSync(designPath).filter((f) => f.endsWith('.json'));
  const designs = [];

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(designPath, file), 'utf-8'));
      designs.push({ ...data, _file: file });
    } catch (err) {
      log.warn(`Failed to parse design file: ${file}`, { error: err.message });
    }
  }

  return designs;
}

function extractDesignData(design) {
  // Handle the format exported from homefield-quoting PWA
  const zones = design.zones || [];
  const greens = design.greens || [];
  const pavers = design.pavers || design.pvs || [];
  const firePits = design.firePits || design.fps || [];
  const walls = design.walls || [];

  // Calculate total sqft from zones
  let totalTurfSqft = 0;
  let totalGreenSqft = 0;
  const zoneDetails = [];

  for (const zone of zones) {
    const sqft = zone.sqft || zone.area || 0;
    totalTurfSqft += sqft;
    zoneDetails.push({
      type: zone.type || zone.s || 'standard',
      sqft,
      name: zone.name || zone.label || '',
    });
  }

  for (const green of greens) {
    const sqft = green.sqft || green.area || 0;
    totalGreenSqft += sqft;
  }

  // Estimate dimensions from sqft (assume roughly square if no explicit dimensions)
  const totalSqft = totalTurfSqft + totalGreenSqft;
  const estWidth = Math.sqrt(totalSqft * 0.6); // wider than tall
  const estLength = totalSqft / estWidth;

  // Calculate perimeter for stakes (rough estimate)
  const perimeter = 2 * (estWidth + estLength);

  // Calculate seam length (turf comes in 15ft rolls)
  const materialsRules = require('../../config/materials-rules.json');
  const rollWidth = materialsRules.turf.rollWidthFeet;
  const numRolls = Math.ceil(estWidth / rollWidth);
  const seamLength = numRolls > 1 ? (numRolls - 1) * estLength : 0;

  return {
    customerName: design.cust || design.customerName || design.customer || 'Unknown',
    address: design.addr || design.address || '',
    designDimensions: {
      length: Math.round(estLength * 10) / 10,
      width: Math.round(estWidth * 10) / 10,
      sqft: Math.round(totalSqft),
      turfSqft: Math.round(totalTurfSqft),
      greenSqft: Math.round(totalGreenSqft),
    },
    zones: zoneDetails,
    paverCount: pavers.length,
    firePitCount: firePits.length,
    wallLinearFeet: walls.reduce((sum, w) => {
      // Calculate wall length from points if available
      if (w.points && w.points.length >= 2) {
        let len = 0;
        for (let i = 1; i < w.points.length; i++) {
          const dx = w.points[i].x - w.points[i - 1].x;
          const dy = w.points[i].y - w.points[i - 1].y;
          len += Math.sqrt(dx * dx + dy * dy);
        }
        return sum + len;
      }
      return sum + (w.length || 0);
    }, 0),
    _seamLength: seamLength,
    _perimeter: perimeter,
    _numRolls: numRolls,
  };
}

function findDesignForJob(designs, job) {
  // Match by customer name, address, or designId
  return designs.find((d) => {
    const dName = (d.cust || d.customerName || '').toLowerCase();
    const dAddr = (d.addr || d.address || '').toLowerCase();
    const jName = (job.customerName || '').toLowerCase();
    const jAddr = (job.address || '').toLowerCase();

    if (job.designId && (d.id === job.designId || d._file === `${job.designId}.json`)) return true;
    if (dName && jName && dName.includes(jName.split(' ')[0])) return true;
    if (dAddr && jAddr && dAddr.includes(jAddr.split(',')[0])) return true;
    return false;
  });
}

function getMockDesigns() {
  return [
    {
      customerName: 'Brown Residence',
      address: '2468 Maple Ave, Waco TX',
      designDimensions: { length: 60, width: 30, sqft: 1800, turfSqft: 1600, greenSqft: 200 },
      zones: [
        { type: 'premium', sqft: 1600, name: 'Main Yard' },
      ],
      paverCount: 0,
      firePitCount: 0,
      wallLinearFeet: 0,
      _seamLength: 60,
      _perimeter: 180,
      _numRolls: 2,
    },
  ];
}

async function collect() {
  log.info('Collecting design tool data...');

  const rawDesigns = readDesignFiles();

  if (rawDesigns.length === 0) {
    log.warn('No design files found, returning mock data');
    return { designs: getMockDesigns(), _mock: true };
  }

  const designs = rawDesigns.map(extractDesignData);
  log.info(`Found ${designs.length} design file(s)`);
  return { designs };
}

module.exports = { collect, findDesignForJob, extractDesignData };
