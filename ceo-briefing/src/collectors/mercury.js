const axios = require('axios');
const dayjs = require('dayjs');
const config = require('../config');
const { createLogger } = require('../utils/logger');
const { withRetry } = require('../utils/retry');

const log = createLogger('mercury');

function createClient(apiToken) {
  return axios.create({
    baseURL: config.mercury.baseUrl,
    headers: { Authorization: `Bearer ${apiToken}` },
    timeout: 30000,
  });
}

async function fetchAccountBalance(client, accountId) {
  const res = await client.get(`/account/${accountId}`);
  return res.data;
}

async function fetchTransactions(client, accountId, start, end) {
  const transactions = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const res = await client.get(`/account/${accountId}/transactions`, {
      params: { start, end, limit, offset },
    });
    const batch = res.data.transactions || [];
    transactions.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return transactions;
}

function categorizeTransaction(txn) {
  const desc = (txn.dashboardNote || txn.bankDescription || txn.note || '').toLowerCase();
  if (desc.includes('payroll') || desc.includes('gusto')) return 'payroll';
  if (desc.includes('material') || desc.includes('turf') || desc.includes('supply') || desc.includes('infill'))
    return 'materials';
  if (desc.includes('rent') || desc.includes('insurance') || desc.includes('utility') || desc.includes('electric') || desc.includes('water'))
    return 'operating';
  if (desc.includes('fuel') || desc.includes('gas') || desc.includes('vehicle'))
    return 'vehicle';
  return 'other';
}

function processTransactions(transactions) {
  let inflows = 0;
  let outflows = 0;
  const categorized = { payroll: 0, materials: 0, operating: 0, vehicle: 0, other: 0 };
  const detailed = [];

  for (const txn of transactions) {
    const amount = txn.amount || 0;
    if (amount > 0) inflows += amount;
    else outflows += Math.abs(amount);

    const category = categorizeTransaction(txn);
    categorized[category] += Math.abs(amount);

    detailed.push({
      amount,
      description: txn.dashboardNote || txn.bankDescription || 'N/A',
      date: txn.postedAt || txn.createdAt,
      category,
      status: txn.status,
    });
  }

  return { inflows, outflows, categorized, detailed };
}

function buildWeeklyHistory(transactions, weeks = 12) {
  const now = dayjs();
  const history = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = now.subtract(w, 'week').startOf('week');
    const weekEnd = weekStart.endOf('week');

    const weekTxns = transactions.filter((t) => {
      const d = dayjs(t.postedAt || t.createdAt);
      return d.isAfter(weekStart) && d.isBefore(weekEnd);
    });

    let inflows = 0;
    let outflows = 0;
    for (const t of weekTxns) {
      if (t.amount > 0) inflows += t.amount;
      else outflows += Math.abs(t.amount);
    }

    history.push({
      weekStart: weekStart.format('YYYY-MM-DD'),
      inflows: Math.round(inflows * 100) / 100,
      outflows: Math.round(outflows * 100) / 100,
      netCash: Math.round((inflows - outflows) * 100) / 100,
    });
  }

  return history;
}

function projectForward(weeklyHistory, currentBalance) {
  const recentWeeks = weeklyHistory.slice(-4);
  const avgInflows = recentWeeks.reduce((s, w) => s + w.inflows, 0) / recentWeeks.length;
  const avgOutflows = recentWeeks.reduce((s, w) => s + w.outflows, 0) / recentWeeks.length;

  const projections = [];
  let balance = currentBalance;

  for (let w = 1; w <= 4; w++) {
    const weekStart = dayjs().add(w, 'week').startOf('week').format('YYYY-MM-DD');
    balance += avgInflows - avgOutflows;
    projections.push({
      weekStart,
      expectedInflows: Math.round(avgInflows * 100) / 100,
      expectedOutflows: Math.round(avgOutflows * 100) / 100,
      projectedBalance: Math.round(balance * 100) / 100,
    });
  }

  return projections;
}

async function collectForAccount(label, apiToken, accountId) {
  if (!apiToken || !accountId) {
    log.warn(`${label}: Mercury not configured, returning mock data`);
    return getMockData(label);
  }

  const client = createClient(apiToken);
  const yesterday = dayjs().subtract(1, 'day');
  const twelveWeeksAgo = dayjs().subtract(12, 'week');

  const [account, yesterdayTxns, allTxns, pendingRes] = await Promise.all([
    withRetry(() => fetchAccountBalance(client, accountId), { label: `${label} balance` }),
    withRetry(
      () =>
        fetchTransactions(client, accountId, yesterday.format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')),
      { label: `${label} yesterday txns` }
    ),
    withRetry(
      () =>
        fetchTransactions(
          client,
          accountId,
          twelveWeeksAgo.format('YYYY-MM-DD'),
          dayjs().format('YYYY-MM-DD')
        ),
      { label: `${label} 12-week txns` }
    ),
    withRetry(
      () =>
        client.get(`/account/${accountId}/transactions`, { params: { status: 'pending' } }),
      { label: `${label} pending txns` }
    ),
  ]);

  const currentBalance = account.currentBalance || account.availableBalance || 0;
  const yesterdayProcessed = processTransactions(yesterdayTxns);
  const weeklyHistory = buildWeeklyHistory(allTxns, 12);
  const projectedWeeks = projectForward(weeklyHistory, currentBalance);

  const pending = (pendingRes.data.transactions || []).map((t) => ({
    amount: t.amount,
    description: t.dashboardNote || t.bankDescription || 'N/A',
    date: t.estimatedDeliveryDate || t.createdAt,
    category: categorizeTransaction(t),
  }));

  return {
    currentBalance,
    yesterdayInflows: yesterdayProcessed.inflows,
    yesterdayOutflows: yesterdayProcessed.outflows,
    pendingTransactions: pending,
    weeklyHistory,
    projectedWeeks,
    categorizedSpending: yesterdayProcessed.categorized,
  };
}

function getMockData(label) {
  const now = dayjs();
  return {
    currentBalance: label === 'homefield' ? 42350.0 : 18200.0,
    yesterdayInflows: label === 'homefield' ? 8500.0 : 3200.0,
    yesterdayOutflows: label === 'homefield' ? 3200.0 : 1100.0,
    pendingTransactions: [
      { amount: -1500, description: 'Pending — materials order', date: now.format('YYYY-MM-DD'), category: 'materials' },
    ],
    weeklyHistory: Array.from({ length: 12 }, (_, i) => ({
      weekStart: now.subtract(11 - i, 'week').startOf('week').format('YYYY-MM-DD'),
      inflows: 5000 + Math.random() * 10000,
      outflows: 3000 + Math.random() * 6000,
      netCash: 1000 + Math.random() * 4000,
    })),
    projectedWeeks: Array.from({ length: 4 }, (_, i) => ({
      weekStart: now.add(i + 1, 'week').startOf('week').format('YYYY-MM-DD'),
      expectedInflows: 7000 + Math.random() * 3000,
      expectedOutflows: 4000 + Math.random() * 2000,
      projectedBalance: (label === 'homefield' ? 42350 : 18200) + (i + 1) * 2000,
    })),
    categorizedSpending: { payroll: 1200, materials: 800, operating: 600, vehicle: 200, other: 400 },
    _mock: true,
  };
}

async function collect() {
  log.info('Collecting Mercury bank data...');

  const [homefield, secondPoolCare] = await Promise.allSettled([
    collectForAccount('homefield', config.mercury.homefield.apiToken, config.mercury.homefield.accountId),
    collectForAccount(
      'secondPoolCare',
      config.mercury.secondPoolCare.apiToken,
      config.mercury.secondPoolCare.accountId
    ),
  ]);

  return {
    homefield: homefield.status === 'fulfilled' ? homefield.value : getMockData('homefield'),
    secondPoolCare:
      secondPoolCare.status === 'fulfilled' ? secondPoolCare.value : getMockData('secondPoolCare'),
    _errors: [
      homefield.status === 'rejected' ? `Homefield: ${homefield.reason.message}` : null,
      secondPoolCare.status === 'rejected' ? `Second Pool Care: ${secondPoolCare.reason.message}` : null,
    ].filter(Boolean),
  };
}

module.exports = { collect };
