const axios = require('axios');
const dayjs = require('dayjs');
const config = require('../config');
const { createLogger } = require('../utils/logger');
const { withRetry } = require('../utils/retry');

const log = createLogger('gusto');

let cachedAccessToken = null;
let tokenExpiry = null;

async function getAccessToken() {
  if (cachedAccessToken && tokenExpiry && dayjs().isBefore(tokenExpiry)) {
    return cachedAccessToken;
  }

  const res = await axios.post(config.gusto.tokenUrl, {
    grant_type: 'refresh_token',
    client_id: config.gusto.clientId,
    client_secret: config.gusto.clientSecret,
    refresh_token: config.gusto.refreshToken,
  });

  cachedAccessToken = res.data.access_token;
  tokenExpiry = dayjs().add(res.data.expires_in - 300, 'second'); // refresh 5 min early
  return cachedAccessToken;
}

function createClient(accessToken) {
  return axios.create({
    baseURL: config.gusto.baseUrl,
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 30000,
  });
}

async function collectLive() {
  const token = await getAccessToken();
  const client = createClient(token);
  const companyId = config.gusto.companyId;

  const [payrollsRes, employeesRes] = await Promise.all([
    withRetry(() => client.get(`/companies/${companyId}/payrolls`), { label: 'Gusto payrolls' }),
    withRetry(() => client.get(`/companies/${companyId}/employees`), { label: 'Gusto employees' }),
  ]);

  const payrolls = payrollsRes.data || [];
  const employees = employeesRes.data || [];
  const now = dayjs();

  // Find last completed and next upcoming payroll
  const completedPayrolls = payrolls
    .filter((p) => p.processed || p.status === 'processed')
    .sort((a, b) => dayjs(b.check_date || b.pay_period?.end_date).diff(dayjs(a.check_date || a.pay_period?.end_date)));

  const upcomingPayrolls = payrolls
    .filter((p) => !p.processed && p.status !== 'processed')
    .sort((a, b) => dayjs(a.check_date || a.pay_period?.end_date).diff(dayjs(b.check_date || b.pay_period?.end_date)));

  const lastPayroll = completedPayrolls[0];
  const nextPayroll = upcomingPayrolls[0];

  // Calculate YTD total
  const yearStart = now.startOf('year');
  const ytdPayrolls = completedPayrolls.filter((p) =>
    dayjs(p.check_date || p.pay_period?.end_date).isAfter(yearStart)
  );
  const ytdTotal = ytdPayrolls.reduce((sum, p) => {
    const totals = p.totals || {};
    return sum + (totals.gross_pay || totals.company_debit || 0);
  }, 0);

  // Build last payroll breakdown
  const lastBreakdown = lastPayroll?.employee_compensations?.map((ec) => ({
    name: ec.employee?.name || `Employee ${ec.employee_id}`,
    gross: ec.gross_pay || 0,
    net: ec.net_pay || 0,
    taxes: (ec.gross_pay || 0) - (ec.net_pay || 0),
  })) || [];

  // Alerts
  const alerts = [];
  const activeEmployees = employees.filter((e) => e.terminated === false || e.status === 'active');

  if (nextPayroll) {
    const daysUntil = dayjs(nextPayroll.check_date || nextPayroll.pay_period?.end_date).diff(now, 'day');
    if (daysUntil <= 2) {
      alerts.push(`Payroll due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`);
    }
  }

  return {
    nextPayroll: nextPayroll
      ? {
          date: nextPayroll.check_date || nextPayroll.pay_period?.end_date,
          estimatedTotal: nextPayroll.totals?.gross_pay || lastPayroll?.totals?.gross_pay || 0,
          employeeCount: activeEmployees.length,
        }
      : null,
    lastPayroll: lastPayroll
      ? {
          date: lastPayroll.check_date || lastPayroll.pay_period?.end_date,
          total: lastPayroll.totals?.gross_pay || lastPayroll.totals?.company_debit || 0,
          breakdown: lastBreakdown,
        }
      : null,
    ytdTotal,
    alerts,
    employeeCount: activeEmployees.length,
  };
}

function getMockData() {
  const now = dayjs();
  return {
    nextPayroll: {
      date: now.add(5, 'day').format('YYYY-MM-DD'),
      estimatedTotal: 4200,
      employeeCount: 2,
    },
    lastPayroll: {
      date: now.subtract(9, 'day').format('YYYY-MM-DD'),
      total: 4150,
      breakdown: [
        { name: 'Trevor', gross: 2800, net: 2240, taxes: 560 },
        { name: 'Helper', gross: 1350, net: 1080, taxes: 270 },
      ],
    },
    ytdTotal: 52000,
    alerts: [],
    employeeCount: 2,
    _mock: true,
  };
}

async function collect() {
  log.info('Collecting Gusto payroll data...');

  if (!config.gusto.clientId || !config.gusto.refreshToken) {
    log.warn('Gusto not configured, returning mock data');
    return getMockData();
  }

  try {
    return await collectLive();
  } catch (err) {
    log.error('Gusto collection failed, returning mock data', { error: err.message });
    return { ...getMockData(), _error: err.message };
  }
}

module.exports = { collect };
