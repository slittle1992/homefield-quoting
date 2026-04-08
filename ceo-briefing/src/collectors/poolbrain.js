const axios = require('axios');
const dayjs = require('dayjs');
const config = require('../config');
const { createLogger } = require('../utils/logger');
const { withRetry } = require('../utils/retry');

const log = createLogger('poolbrain');

function createClient() {
  return axios.create({
    baseURL: config.poolBrain.baseUrl,
    headers: {
      'x-api-key': config.poolBrain.apiKey,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}

async function collectLive() {
  const client = createClient();
  const today = dayjs().format('YYYY-MM-DD');
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  const weekEnd = dayjs().endOf('week').format('YYYY-MM-DD');

  const [todayRes, yesterdayRes, weekRes, customersRes] = await Promise.all([
    withRetry(() => client.get('/services', { params: { date: today } }), { label: 'PB today' }).catch(() => ({ data: [] })),
    withRetry(() => client.get('/services', { params: { date: yesterday } }), { label: 'PB yesterday' }).catch(() => ({ data: [] })),
    withRetry(() => client.get('/services', { params: { startDate: today, endDate: weekEnd } }), { label: 'PB week' }).catch(() => ({ data: [] })),
    withRetry(() => client.get('/customers', { params: { hasIssues: true } }), { label: 'PB customers' }).catch(() => ({ data: [] })),
  ]);

  const todayServices = Array.isArray(todayRes.data) ? todayRes.data : todayRes.data?.services || [];
  const yesterdayServices = Array.isArray(yesterdayRes.data) ? yesterdayRes.data : yesterdayRes.data?.services || [];
  const weekServices = Array.isArray(weekRes.data) ? weekRes.data : weekRes.data?.services || [];
  const flaggedCustomers = Array.isArray(customersRes.data) ? customersRes.data : customersRes.data?.customers || [];

  const todayRoutes = todayServices.map((s) => ({
    customerName: s.customerName || s.customer?.name || 'Unknown',
    address: s.address || s.customer?.address || '',
    serviceType: s.serviceType || s.type || 'Regular Service',
    scheduledTime: s.scheduledTime || s.time || 'TBD',
    notes: s.notes || '',
  }));

  const yesterdayCompleted = yesterdayServices.map((s) => ({
    customerName: s.customerName || s.customer?.name || 'Unknown',
    serviceType: s.serviceType || s.type || 'Regular Service',
    completed: s.completed !== false && s.status !== 'missed',
    notes: s.notes || '',
  }));

  // Build week schedule counts by day
  const weekSchedule = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 };
  const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  for (const s of weekServices) {
    const day = dayMap[dayjs(s.date || s.scheduledDate).day()];
    if (day) weekSchedule[day]++;
  }

  const overdueServices = todayServices
    .filter((s) => {
      const lastService = s.lastServiceDate || s.customer?.lastServiceDate;
      return lastService && dayjs().diff(dayjs(lastService), 'day') > 14;
    })
    .map((s) => ({
      customerName: s.customerName || s.customer?.name || 'Unknown',
      lastService: s.lastServiceDate || s.customer?.lastServiceDate,
      daysPastDue: dayjs().diff(dayjs(s.lastServiceDate || s.customer?.lastServiceDate), 'day') - 7,
    }));

  const customerAlerts = flaggedCustomers.map((c) => ({
    customerName: c.name || c.customerName || 'Unknown',
    issue: c.issue || c.notes || 'Flagged',
    priority: c.priority || 'medium',
  }));

  const completedCount = yesterdayCompleted.filter((s) => s.completed).length;
  const completionRate = yesterdayCompleted.length > 0 ? (completedCount / yesterdayCompleted.length) * 100 : 100;

  return {
    todayRoutes,
    yesterdayCompleted,
    weekSchedule,
    overdueServices,
    customerAlerts,
    completionRate: Math.round(completionRate * 10) / 10,
  };
}

function getMockData() {
  return {
    todayRoutes: [
      { customerName: 'Henderson Pool', address: '100 Lake Dr, Waco TX', serviceType: 'Weekly Clean', scheduledTime: '8:00 AM', notes: '' },
      { customerName: 'Parker Residence', address: '205 River Rd, Waco TX', serviceType: 'Weekly Clean', scheduledTime: '9:30 AM', notes: 'Gate code: 1234' },
      { customerName: 'Clark Estate', address: '310 Hill St, Waco TX', serviceType: 'Chemical Balance', scheduledTime: '11:00 AM', notes: 'Check filter pressure' },
      { customerName: 'Wright Home', address: '415 Valley Ln, Waco TX', serviceType: 'Weekly Clean', scheduledTime: '1:00 PM', notes: '' },
      { customerName: 'King Property', address: '520 Summit Ave, Waco TX', serviceType: 'Weekly Clean + Vacuum', scheduledTime: '2:30 PM', notes: 'Dog in backyard' },
    ],
    yesterdayCompleted: [
      { customerName: 'Adams Pool', serviceType: 'Weekly Clean', completed: true, notes: '' },
      { customerName: 'Baker Residence', serviceType: 'Weekly Clean', completed: true, notes: '' },
      { customerName: 'Cooper Home', serviceType: 'Filter Clean', completed: true, notes: 'Replaced O-ring' },
      { customerName: 'Evans Estate', serviceType: 'Weekly Clean', completed: false, notes: 'Gate locked — rescheduled' },
    ],
    weekSchedule: { mon: 6, tue: 5, wed: 6, thu: 5, fri: 4, sat: 0, sun: 0 },
    overdueServices: [
      { customerName: 'Mitchell Pool', lastService: dayjs().subtract(16, 'day').format('YYYY-MM-DD'), daysPastDue: 9 },
    ],
    customerAlerts: [
      { customerName: 'Evans Estate', issue: 'Gate access issue — need new code', priority: 'high' },
      { customerName: 'Fisher Home', issue: 'Pump making noise — may need repair', priority: 'medium' },
    ],
    completionRate: 75.0,
    _mock: true,
  };
}

async function collect() {
  log.info('Collecting Pool Brain data...');

  if (!config.poolBrain.apiKey) {
    log.warn('Pool Brain not configured, returning mock data');
    return getMockData();
  }

  try {
    return await collectLive();
  } catch (err) {
    log.error('Pool Brain collection failed, returning mock data', { error: err.message });
    return { ...getMockData(), _error: err.message };
  }
}

module.exports = { collect };
