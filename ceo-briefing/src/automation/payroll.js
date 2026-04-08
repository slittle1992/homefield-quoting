const dayjs = require('dayjs');
const { createLogger } = require('../utils/logger');

const log = createLogger('payroll');

const thresholds = require('../../config/thresholds.json');

function analyzePayroll(gustoData, mercuryData) {
  const alerts = [];
  const now = dayjs();

  // Check if payroll is coming up soon
  if (gustoData?.nextPayroll?.date) {
    const daysUntil = dayjs(gustoData.nextPayroll.date).diff(now, 'day');

    if (daysUntil <= thresholds.payroll.prePayrollAlertDays) {
      alerts.push({
        type: 'warning',
        message: `Payroll due in ${daysUntil} day${daysUntil === 1 ? '' : 's'} — estimated ${formatCurrency(gustoData.nextPayroll.estimatedTotal)}`,
      });

      // Check if cash covers payroll
      const htBalance = mercuryData?.homefield?.currentBalance || 0;
      const payrollAmount = gustoData.nextPayroll.estimatedTotal || 0;

      if (htBalance < payrollAmount * 1.5) {
        alerts.push({
          type: 'critical',
          message: `Cash balance (${formatCurrency(htBalance)}) is less than 1.5× payroll (${formatCurrency(payrollAmount)})`,
        });
      }
    }
  }

  // Include any Gusto-level alerts
  if (gustoData?.alerts) {
    for (const alert of gustoData.alerts) {
      alerts.push({ type: 'warning', message: alert });
    }
  }

  // Build payroll projection for cash flow
  const payrollProjection = buildPayrollProjection(gustoData);

  return { alerts, payrollProjection };
}

function buildPayrollProjection(gustoData) {
  if (!gustoData?.nextPayroll?.date || !gustoData?.nextPayroll?.estimatedTotal) {
    return [];
  }

  const projections = [];
  const baseDate = dayjs(gustoData.nextPayroll.date);
  const amount = gustoData.nextPayroll.estimatedTotal;

  // Project next 4 payroll dates (biweekly assumed)
  for (let i = 0; i < 4; i++) {
    projections.push({
      date: baseDate.add(i * 14, 'day').format('YYYY-MM-DD'),
      amount,
    });
  }

  return projections;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

module.exports = { analyzePayroll };
