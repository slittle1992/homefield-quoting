const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { createLogger } = require('../utils/logger');
const { currency } = require('../utils/formatters');

const log = createLogger('ordering');

const materialsRules = require('../../config/materials-rules.json');
let suppliersConfig;
try {
  suppliersConfig = require('../../config/suppliers.json');
} catch {
  suppliersConfig = { primary: { name: '', email: '' } };
}

function calculateMaterials(design) {
  const totalSqft = design.designDimensions?.sqft || 0;
  const turfSqft = design.designDimensions?.turfSqft || totalSqft;
  const greenSqft = design.designDimensions?.greenSqft || 0;

  // Turf roll calculation (15ft wide rolls)
  const rollWidth = materialsRules.turf.rollWidthFeet;
  const wasteFactor = materialsRules.turf.wasteFactor;
  const totalWithWaste = Math.ceil(totalSqft * (1 + wasteFactor));
  const rollLengthNeeded = Math.ceil(totalWithWaste / rollWidth);

  // Infill
  const infillLbs = Math.ceil(totalSqft * materialsRules.infill.lbsPerSqft);

  // Seam tape (from design's calculated seam length)
  const seamLinearFeet = design._seamLength || 0;

  // Adhesive
  const adhesiveGallons = Math.ceil(totalSqft / materialsRules.adhesive.sqftPerGallon);

  // Stakes (perimeter + seam nailing)
  const perimeter = design._perimeter || Math.sqrt(totalSqft) * 4;
  const stakesCount = Math.ceil(perimeter / materialsRules.stakes.spacingFeet);

  return {
    turf: {
      rollWidth,
      rollLengthNeeded,
      totalSqft: totalWithWaste,
      rawSqft: totalSqft,
      wasteFactor,
      numRolls: design._numRolls || Math.ceil(Math.sqrt(totalSqft * 0.6) / rollWidth),
    },
    infill: {
      type: 'Silica Sand / Crumb Rubber Blend',
      lbsNeeded: infillLbs,
    },
    seamTape: {
      linearFeet: Math.ceil(seamLinearFeet),
    },
    adhesive: {
      gallons: adhesiveGallons,
    },
    stakes: {
      count: stakesCount,
    },
    puttingGreen: greenSqft > 0
      ? { sqft: greenSqft, rollLengthNeeded: Math.ceil(greenSqft * (1 + wasteFactor) / rollWidth) }
      : null,
  };
}

function generateOrderEmailDraft(job, design, materials) {
  const supplier = suppliersConfig.primary;
  const deliveryDate = job.installDate
    ? dayjs(job.installDate).subtract(2, 'day').format('MMMM D, YYYY')
    : 'TBD — please confirm';

  const subject = `Material Order — ${job.customerName} — ${job.address || 'Address TBD'}`;

  const itemLines = [];
  itemLines.push(`• Artificial Turf: ${materials.turf.totalSqft} sqft (${materials.turf.numRolls} rolls × ${materials.turf.rollWidth}ft wide × ${materials.turf.rollLengthNeeded}ft long, includes ${(materials.turf.wasteFactor * 100).toFixed(0)}% waste)`);
  if (materials.puttingGreen) {
    itemLines.push(`• Putting Green Turf: ${materials.puttingGreen.sqft} sqft (${materials.puttingGreen.rollLengthNeeded}ft roll length)`);
  }
  itemLines.push(`• Infill (${materials.infill.type}): ${materials.infill.lbsNeeded} lbs`);
  if (materials.seamTape.linearFeet > 0) {
    itemLines.push(`• Seam Tape: ${materials.seamTape.linearFeet} linear feet`);
  }
  itemLines.push(`• Adhesive: ${materials.adhesive.gallons} gallons`);
  itemLines.push(`• Landscape Stakes: ${materials.stakes.count} count`);

  const body = `Hi ${supplier.name || '[Supplier Name]'},

I'd like to place an order for an upcoming installation:

Customer: ${job.customerName}
Job Site: ${job.address || 'TBD'}
Install Date: ${job.installDate ? dayjs(job.installDate).format('MMMM D, YYYY') : 'TBD'}
Requested Delivery: ${deliveryDate}

Materials Needed:
${itemLines.join('\n')}

Delivery Address: ${job.address || '[Job Site / Shop Address]'}

Please confirm availability and pricing at your earliest convenience.

Thank you,
Homefield Turf`;

  return {
    to: supplier.email || '[SUPPLIER EMAIL]',
    subject,
    body,
    materials,
    job: { customerName: job.customerName, address: job.address, installDate: job.installDate },
    _isDraft: true,
  };
}

function processNewlySoldJobs(newlySoldJobs, designData) {
  const designs = designData?.designs || [];
  const { findDesignForJob } = require('../collectors/designtool');
  const orderDrafts = [];

  for (const job of newlySoldJobs || []) {
    log.info(`Processing newly sold job: ${job.customerName}`);

    const design = findDesignForJob(designs, job);

    if (!design) {
      log.warn(`No design found for job: ${job.customerName} — using estimates from job scope`);
      // Create a basic estimate from the job scope
      const sqftMatch = (job.scope || '').match(/(\d[\d,]*)\s*sqft/i);
      const estimatedSqft = sqftMatch ? parseInt(sqftMatch[1].replace(',', '')) : 1000;
      const mockDesign = {
        customerName: job.customerName,
        address: job.address,
        designDimensions: { sqft: estimatedSqft, turfSqft: estimatedSqft, greenSqft: 0, length: Math.sqrt(estimatedSqft), width: Math.sqrt(estimatedSqft) },
        _seamLength: Math.sqrt(estimatedSqft),
        _perimeter: 4 * Math.sqrt(estimatedSqft),
        _numRolls: Math.ceil(Math.sqrt(estimatedSqft * 0.6) / 15),
      };
      const materials = calculateMaterials(mockDesign);
      orderDrafts.push(generateOrderEmailDraft(job, mockDesign, materials));
      continue;
    }

    const materials = calculateMaterials(design);
    orderDrafts.push(generateOrderEmailDraft(job, design, materials));
  }

  return orderDrafts;
}

module.exports = { calculateMaterials, generateOrderEmailDraft, processNewlySoldJobs };
