const cron = require('node-cron');
const config = require('./config');
const { createLogger } = require('./utils/logger');

// Collectors
const mercury = require('./collectors/mercury');
const builderPrime = require('./collectors/builderprime');
const gusto = require('./collectors/gusto');
const poolBrain = require('./collectors/poolbrain');
const flyers = require('./collectors/flyers');
const designTool = require('./collectors/designtool');

// Automation
const { processNewlySoldJobs } = require('./automation/ordering');
const { generateAllProjectPlans } = require('./automation/projectplan');
const { analyzeInvoices, generateInvoiceAlerts } = require('./automation/invoicing');
const { analyzePayroll } = require('./automation/payroll');

// AI
const { runAnalysis } = require('./analysis/ai-insights');

// Email
const { buildCEOEmail, buildTrevorEmail, buildStevenEmail } = require('./email/builder');
const { sendEmail } = require('./email/sender');

const log = createLogger('main');

async function runMorningBriefing() {
  const startTime = Date.now();
  log.info('=== Starting Morning Briefing ===');

  // 1. Collect data from all sources in parallel
  log.info('Phase 1: Collecting data from all sources...');
  const [mercuryResult, bpResult, gustoResult, pbResult, flyerResult, designResult] =
    await Promise.allSettled([
      mercury.collect(),
      builderPrime.collect(),
      gusto.collect(),
      poolBrain.collect(),
      flyers.collect(),
      designTool.collect(),
    ]);

  const data = {
    mercury: mercuryResult.status === 'fulfilled' ? mercuryResult.value : null,
    builderPrime: bpResult.status === 'fulfilled' ? bpResult.value : null,
    gusto: gustoResult.status === 'fulfilled' ? gustoResult.value : null,
    poolBrain: pbResult.status === 'fulfilled' ? pbResult.value : null,
    flyers: flyerResult.status === 'fulfilled' ? flyerResult.value : null,
    designTool: designResult.status === 'fulfilled' ? designResult.value : null,
  };

  // Log any collection failures
  const failures = [];
  if (mercuryResult.status === 'rejected') failures.push(`Mercury: ${mercuryResult.reason.message}`);
  if (bpResult.status === 'rejected') failures.push(`Builder Prime: ${bpResult.reason.message}`);
  if (gustoResult.status === 'rejected') failures.push(`Gusto: ${gustoResult.reason.message}`);
  if (pbResult.status === 'rejected') failures.push(`Pool Brain: ${pbResult.reason.message}`);
  if (flyerResult.status === 'rejected') failures.push(`Flyers: ${flyerResult.reason.message}`);
  if (designResult.status === 'rejected') failures.push(`Design Tool: ${designResult.reason.message}`);

  if (failures.length > 0) {
    log.warn(`${failures.length} collector(s) had issues`, { failures });
  }

  // 2. Process newly sold jobs (ordering automation)
  log.info('Phase 2: Processing automation...');
  const orderDrafts = processNewlySoldJobs(
    data.builderPrime?.newlySoldJobs,
    data.designTool
  );

  const projectPlans = generateAllProjectPlans(
    data.builderPrime?.newlySoldJobs,
    orderDrafts
  );

  // Invoice & payroll analysis
  const invoicing = analyzeInvoices(data.mercury);
  const invoiceAlerts = generateInvoiceAlerts(invoicing, data.builderPrime);
  const payroll = analyzePayroll(data.gusto, data.mercury);

  // Build alerts list
  const alerts = [
    ...invoiceAlerts,
    ...payroll.alerts.map((a) => ({ ...a, business: 'Homefield Turf' })),
  ];

  // Check cash thresholds
  const thresholds = require('../config/thresholds.json');
  if (data.mercury?.homefield) {
    const htBal = data.mercury.homefield.currentBalance;
    if (htBal < thresholds.cashFlow.homefield.criticalLow) {
      alerts.unshift({ type: 'critical', business: 'Homefield Turf', message: `Cash balance critically low: $${htBal.toLocaleString()}` });
    } else if (htBal < thresholds.cashFlow.homefield.warningLow) {
      alerts.push({ type: 'warning', business: 'Homefield Turf', message: `Cash balance below warning threshold: $${htBal.toLocaleString()}` });
    }
  }
  if (data.mercury?.secondPoolCare) {
    const spcBal = data.mercury.secondPoolCare.currentBalance;
    if (spcBal < thresholds.cashFlow.secondPoolCare.criticalLow) {
      alerts.unshift({ type: 'critical', business: 'Second Pool Care', message: `Cash balance critically low: $${spcBal.toLocaleString()}` });
    } else if (spcBal < thresholds.cashFlow.secondPoolCare.warningLow) {
      alerts.push({ type: 'warning', business: 'Second Pool Care', message: `Cash balance below warning threshold: $${spcBal.toLocaleString()}` });
    }
  }

  // 3. Run AI analysis
  log.info('Phase 3: Running AI analysis...');
  const enrichedData = { ...data, invoicing, payroll, orderDrafts };
  const aiInsights = await runAnalysis(enrichedData);

  // Build action items from alerts + AI
  const actionItems = buildActionItems(data, alerts, orderDrafts);

  // 4. Build three tailored emails
  log.info('Phase 4: Building emails...');
  const fullData = {
    mercury: data.mercury,
    builderPrime: data.builderPrime,
    gusto: data.gusto,
    poolBrain: data.poolBrain,
    flyers: data.flyers,
    invoicing,
    payroll,
    orderDrafts,
    aiInsights,
    alerts,
    actionItems,
  };

  const ceoEmail = buildCEOEmail(fullData);
  const trevorEmail = buildTrevorEmail({
    todayAppointments: data.builderPrime?.todayAppointments || [],
    projectPlans,
    productionPipeline: data.builderPrime?.productionPipeline || [],
    ceoNotes: '',
  });
  const stevenEmail = buildStevenEmail({
    todayRoutes: data.poolBrain?.todayRoutes || [],
    yesterdayCompletion: data.poolBrain?.completionRate || 100,
    customerAlerts: data.poolBrain?.customerAlerts || [],
    invoicing: invoicing?.secondPoolCare,
    weekSchedule: data.poolBrain?.weekSchedule || {},
    ceoNotes: '',
  });

  // 5. Send emails
  log.info('Phase 5: Sending emails...');
  const emailResults = await Promise.allSettled([
    sendEmail({ to: config.recipients.ceo, ...ceoEmail }),
    sendEmail({ to: config.recipients.trevor, ...trevorEmail }),
    sendEmail({ to: config.recipients.steven, ...stevenEmail }),
  ]);

  const sentCount = emailResults.filter((r) => r.status === 'fulfilled' && r.value?.sent).length;
  const skippedCount = emailResults.filter((r) => r.status === 'fulfilled' && r.value?.skipped).length;
  const failedCount = emailResults.filter((r) => r.status === 'rejected').length;

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log.info(`=== Morning Briefing Complete (${elapsed}s) ===`, {
    sent: sentCount,
    skipped: skippedCount,
    failed: failedCount,
    collectorsDown: failures.length,
    alertCount: alerts.length,
    orderDrafts: orderDrafts.length,
  });

  return { sent: sentCount, skipped: skippedCount, failed: failedCount };
}

function buildActionItems(data, alerts, orderDrafts) {
  const items = [];

  // Critical alerts first
  for (const alert of alerts.filter((a) => a.type === 'critical')) {
    items.push(`🔴 URGENT: ${alert.message}`);
  }

  // Follow-up on stale proposals
  const staleProposals = (data.builderPrime?.activeProposals || []).filter((p) => {
    const daysSinceSent = require('dayjs')().diff(require('dayjs')(p.dateSent), 'day');
    return daysSinceSent >= 7;
  });
  for (const p of staleProposals) {
    items.push(`🟡 Follow up on stale proposal: ${p.customerName} (${require('./utils/formatters').currency(p.amount)}) — sent ${require('dayjs')(p.dateSent).fromNow?.() || p.dateSent}`);
  }

  // New leads to contact
  const newLeads = data.builderPrime?.newLeads || [];
  if (newLeads.length > 0) {
    items.push(`🟢 ${newLeads.length} new lead(s) to contact: ${newLeads.map((l) => l.name).join(', ')}`);
  }

  // Review supplier order drafts
  if (orderDrafts.length > 0) {
    items.push(`🟡 Review and send ${orderDrafts.length} supplier order draft(s)`);
  }

  // Warning alerts
  for (const alert of alerts.filter((a) => a.type === 'warning')) {
    items.push(`🟡 ${alert.message}`);
  }

  return items.slice(0, 10);
}

// --- Startup ---

if (config.isNow) {
  // Run immediately (for testing)
  log.info('Running briefing immediately (--now flag)');
  runMorningBriefing()
    .then((result) => {
      log.info('Briefing run complete', result);
      return flyers.shutdown().catch(() => {});
    })
    .then(() => process.exit(0))
    .catch((err) => {
      log.error('Fatal error', { error: err.message, stack: err.stack });
      flyers.shutdown().catch(() => {});
      process.exit(1);
    });
} else {
  // Schedule for 8:00 AM CST daily
  log.info('CEO Morning Briefing system starting...');
  log.info(`Test mode: ${config.isTest ? 'ON (all emails go to CEO)' : 'OFF'}`);
  log.info('Scheduled: 8:00 AM CST daily');

  cron.schedule('0 8 * * *', () => {
    runMorningBriefing().catch((err) => {
      log.error('Briefing run failed', { error: err.message, stack: err.stack });
    });
  }, { timezone: 'America/Chicago' });

  log.info('Cron job registered. Waiting for next run...');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    log.info('Shutting down...');
    await flyers.shutdown().catch(() => {});
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    log.info('Shutting down...');
    await flyers.shutdown().catch(() => {});
    process.exit(0);
  });
}
