const dayjs = require('dayjs');
const config = require('../config');
const { createLogger } = require('../utils/logger');

const log = createLogger('invoicing');

const thresholds = require('../../config/thresholds.json');

function analyzeInvoices(mercuryData) {
  const spc = mercuryData?.secondPoolCare || {};
  const ht = mercuryData?.homefield || {};

  // Second Pool Care — analyze transactions for invoice patterns
  const spcInvoicing = analyzePoolCareInvoicing(spc);
  const htInvoicing = analyzeHomefieldPayments(ht);

  return { secondPoolCare: spcInvoicing, homefield: htInvoicing };
}

function analyzePoolCareInvoicing(spcData) {
  const transactions = [];
  const weeklyHistory = spcData.weeklyHistory || [];

  // Look at inflows as invoice payments
  const thisMonthInflows = weeklyHistory
    .filter((w) => dayjs(w.weekStart).month() === dayjs().month())
    .reduce((sum, w) => sum + w.inflows, 0);

  const lastMonthInflows = weeklyHistory
    .filter((w) => dayjs(w.weekStart).month() === dayjs().subtract(1, 'month').month())
    .reduce((sum, w) => sum + w.inflows, 0);

  // Track pending as potentially unpaid invoices
  const pendingInflows = (spcData.pendingTransactions || [])
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingOutflows = (spcData.pendingTransactions || [])
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return {
    thisMonthCollected: Math.round(thisMonthInflows * 100) / 100,
    lastMonthCollected: Math.round(lastMonthInflows * 100) / 100,
    pendingPayments: Math.round(pendingInflows * 100) / 100,
    overdueAlerts: [], // Would need invoice-level data from Mercury invoicing
    collectionTrend: thisMonthInflows >= lastMonthInflows * 0.8 ? 'healthy' : 'declining',
  };
}

function analyzeHomefieldPayments(htData) {
  const pending = (htData.pendingTransactions || []).filter((t) => t.amount > 0);

  // Calculate recent inflows as deposit/payment tracking
  const weeklyHistory = htData.weeklyHistory || [];
  const recentWeeks = weeklyHistory.slice(-4);
  const avgWeeklyInflow = recentWeeks.reduce((s, w) => s + w.inflows, 0) / (recentWeeks.length || 1);

  return {
    pendingDeposits: pending.map((t) => ({
      amount: t.amount,
      description: t.description,
      date: t.date,
    })),
    avgWeeklyRevenue: Math.round(avgWeeklyInflow * 100) / 100,
    alerts: [],
  };
}

function generateInvoiceAlerts(invoiceData, builderPrimeData) {
  const alerts = [];

  // Check SPC collection trend
  if (invoiceData.secondPoolCare?.collectionTrend === 'declining') {
    alerts.push({
      type: 'warning',
      business: 'Second Pool Care',
      message: 'Monthly collections trending lower than last month',
    });
  }

  // Check for stale completed jobs without final payment (Homefield)
  const completedJobs = (builderPrimeData?.productionPipeline || []).filter(
    (j) => j.status === 'Completed' || j.status === 'completed'
  );

  for (const job of completedJobs) {
    if (job.scheduledDate) {
      const daysSinceCompletion = dayjs().diff(dayjs(job.scheduledDate), 'day');
      if (daysSinceCompletion > 7) {
        alerts.push({
          type: 'critical',
          business: 'Homefield Turf',
          message: `${job.customerName}: completed ${daysSinceCompletion} days ago — check final payment status`,
        });
      }
    }
  }

  return alerts;
}

module.exports = { analyzeInvoices, generateInvoiceAlerts };
