const dayjs = require('dayjs');
const { createLogger } = require('../utils/logger');

const log = createLogger('projectplan');

function generateProjectPlan(job, orderDraft) {
  const materials = orderDraft?.materials;
  const installDate = job.installDate ? dayjs(job.installDate) : null;
  const deliveryDate = installDate ? installDate.subtract(2, 'day') : null;

  const totalSqft = materials?.turf?.rawSqft || 0;

  // Estimate install time: ~200 sqft/hour for 2-person crew
  const estHours = Math.ceil(totalSqft / 200);
  const estDays = Math.ceil(estHours / 8);

  const plan = {
    customerName: job.customerName,
    address: job.address || 'TBD',
    installDate: installDate ? installDate.format('MMMM D, YYYY') : 'TBD',
    deliveryDate: deliveryDate ? deliveryDate.format('MMMM D, YYYY') : 'TBD',

    sitePrep: [
      'Remove existing landscape / debris',
      'Grade and compact subbase',
      'Install weed barrier fabric',
      'Set perimeter edging / bender board',
    ],

    materialsNeeded: [],
    estimatedTime: `${estHours} hours (~${estDays} day${estDays > 1 ? 's' : ''})`,

    installSteps: [
      'Lay weed barrier if not already placed',
      'Roll out turf — align seams with roll direction',
      'Trim edges to fit perimeter',
      'Seam tape + adhesive at all seams',
      'Nail/stake perimeter every 12 inches',
      'Spread infill evenly — brush in with power broom',
      'Final trim and cleanup',
    ],

    specialNotes: [],
  };

  // Build materials list
  if (materials) {
    plan.materialsNeeded.push(`Turf: ${materials.turf.totalSqft} sqft (${materials.turf.numRolls} rolls)`);
    if (materials.puttingGreen) {
      plan.materialsNeeded.push(`Putting Green: ${materials.puttingGreen.sqft} sqft`);
      plan.installSteps.splice(3, 0, 'Install putting green section with separate seaming');
      plan.specialNotes.push('Putting green requires separate turf type — verify roll is marked');
    }
    plan.materialsNeeded.push(`Infill: ${materials.infill.lbsNeeded} lbs`);
    if (materials.seamTape.linearFeet > 0) {
      plan.materialsNeeded.push(`Seam Tape: ${materials.seamTape.linearFeet} ft`);
    }
    plan.materialsNeeded.push(`Adhesive: ${materials.adhesive.gallons} gallons`);
    plan.materialsNeeded.push(`Stakes: ${materials.stakes.count}`);
  }

  // Add notes from job scope
  if (job.scope) {
    if (job.scope.toLowerCase().includes('putting')) {
      plan.specialNotes.push('Job includes putting green — use putting-specific turf');
    }
    if (job.scope.toLowerCase().includes('paver')) {
      plan.specialNotes.push('Job includes pavers — install pavers before turf');
    }
    if (job.scope.toLowerCase().includes('fire pit')) {
      plan.specialNotes.push('Job includes fire pit — leave cutout area, install after turf');
    }
  }

  return plan;
}

function generateAllProjectPlans(newlySoldJobs, orderDrafts) {
  const plans = [];

  for (const job of newlySoldJobs || []) {
    const matchingDraft = orderDrafts?.find(
      (d) => d.job?.customerName === job.customerName
    );
    plans.push(generateProjectPlan(job, matchingDraft));
  }

  return plans;
}

module.exports = { generateProjectPlan, generateAllProjectPlans };
