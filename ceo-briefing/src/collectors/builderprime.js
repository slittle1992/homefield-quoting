const axios = require('axios');
const dayjs = require('dayjs');
const config = require('../config');
const { createLogger } = require('../utils/logger');
const { withRetry } = require('../utils/retry');

const log = createLogger('builderprime');

function createClient() {
  return axios.create({
    baseURL: `https://${config.builderPrime.subdomain}.builderprime.com/api`,
    headers: {
      'x-api-key': config.builderPrime.apiKey,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}

async function fetchEndpoint(client, endpoint, params = {}) {
  const res = await client.get(endpoint, { params });
  return res.data;
}

async function collectLive() {
  const client = createClient();
  const today = dayjs().format('YYYY-MM-DD');
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  const weekStart = dayjs().startOf('week').format('YYYY-MM-DD');
  const weekEnd = dayjs().endOf('week').format('YYYY-MM-DD');

  const [appointments, leads, proposals, jobs] = await Promise.all([
    withRetry(() => fetchEndpoint(client, '/appointments', { startDate: yesterday, endDate: today }), {
      label: 'BP appointments',
    }).catch(() => []),
    withRetry(() => fetchEndpoint(client, '/leads', { startDate: yesterday, endDate: today }), {
      label: 'BP leads',
    }).catch(() => []),
    withRetry(() => fetchEndpoint(client, '/proposals', { status: 'sent' }), {
      label: 'BP proposals',
    }).catch(() => []),
    withRetry(() => fetchEndpoint(client, '/jobs'), { label: 'BP jobs' }).catch(() => []),
  ]);

  const allAppointments = Array.isArray(appointments) ? appointments : appointments?.data || [];
  const allLeads = Array.isArray(leads) ? leads : leads?.data || [];
  const allProposals = Array.isArray(proposals) ? proposals : proposals?.data || [];
  const allJobs = Array.isArray(jobs) ? jobs : jobs?.data || [];

  const todayAppointments = allAppointments
    .filter((a) => dayjs(a.date || a.scheduledDate).format('YYYY-MM-DD') === today)
    .map((a) => ({
      time: a.time || a.scheduledTime || 'TBD',
      customerName: a.customerName || a.customer?.name || 'Unknown',
      address: a.address || a.customer?.address || '',
      type: a.type || a.appointmentType || 'Appointment',
      assignedTo: a.assignedTo || a.rep || '',
    }));

  const yesterdayResults = allAppointments
    .filter((a) => dayjs(a.date || a.scheduledDate).format('YYYY-MM-DD') === yesterday)
    .map((a) => ({
      customerName: a.customerName || a.customer?.name || 'Unknown',
      type: a.type || a.appointmentType || 'Appointment',
      outcome: a.outcome || a.status || 'Unknown',
      notes: a.notes || '',
    }));

  const newLeads = allLeads
    .filter((l) => dayjs(l.createdAt || l.date).isAfter(dayjs().subtract(1, 'day')))
    .map((l) => ({
      name: l.name || l.customerName || 'Unknown',
      source: l.source || l.leadSource || 'Unknown',
      contactInfo: l.phone || l.email || '',
      date: l.createdAt || l.date,
    }));

  const activeProposals = allProposals.map((p) => ({
    customerName: p.customerName || p.customer?.name || 'Unknown',
    amount: p.total || p.amount || 0,
    dateSent: p.sentDate || p.createdAt,
    followUpDue: dayjs(p.sentDate || p.createdAt)
      .add(config.builderPrime.followUpDays || 3, 'day')
      .format('YYYY-MM-DD'),
  }));

  const newlySoldJobs = allJobs
    .filter(
      (j) =>
        (j.status === 'Sold' || j.status === 'sold') &&
        dayjs(j.soldDate || j.statusChangedAt || j.updatedAt).isAfter(dayjs().subtract(1, 'day'))
    )
    .map((j) => ({
      customerName: j.customerName || j.customer?.name || 'Unknown',
      address: j.address || j.jobAddress || '',
      scope: j.description || j.scope || '',
      amount: j.total || j.amount || 0,
      designId: j.designId || null,
      installDate: j.scheduledDate || j.installDate || null,
    }));

  const productionPipeline = allJobs
    .filter((j) => j.status === 'In Production' || j.status === 'Scheduled' || j.status === 'in_progress')
    .map((j) => ({
      customerName: j.customerName || j.customer?.name || 'Unknown',
      status: j.status,
      scheduledDate: j.scheduledDate || j.installDate || null,
      assignedTo: j.assignedTo || j.rep || '',
    }));

  const totalPipeline = activeProposals.reduce((s, p) => s + p.amount, 0);
  const weekLeads = allLeads.filter((l) =>
    dayjs(l.createdAt || l.date).isAfter(dayjs(weekStart))
  ).length;

  return {
    todayAppointments,
    yesterdayResults,
    newLeads,
    activeProposals,
    newlySoldJobs,
    productionPipeline,
    salesMetrics: {
      pipelineValue: totalPipeline,
      leadsThisWeek: weekLeads,
      appointmentsThisWeek: todayAppointments.length,
      proposalsSent: activeProposals.length,
      jobsSold: newlySoldJobs.length,
      conversionRate: weekLeads > 0 ? Math.round((newlySoldJobs.length / weekLeads) * 100) : 0,
    },
  };
}

function getMockData() {
  const today = dayjs();
  return {
    todayAppointments: [
      { time: '9:00 AM', customerName: 'Johnson Family', address: '1234 Oak Lane, Waco TX', type: 'Estimate', assignedTo: 'Trevor' },
      { time: '11:30 AM', customerName: 'Smith Residence', address: '5678 Elm St, Waco TX', type: 'Estimate', assignedTo: 'Trevor' },
      { time: '2:00 PM', customerName: 'Garcia Project', address: '910 Pine Dr, Waco TX', type: 'Follow-up', assignedTo: 'You' },
    ],
    yesterdayResults: [
      { customerName: 'Williams Home', type: 'Estimate', outcome: 'Proposal Sent', notes: '2,400 sqft backyard' },
      { customerName: 'Brown Residence', type: 'Follow-up', outcome: 'Sold', notes: 'Signed contract — $12,800' },
    ],
    newLeads: [
      { name: 'Davis Family', source: 'Flyer', contactInfo: '254-555-0123', date: today.subtract(6, 'hour').toISOString() },
      { name: 'Martinez Home', source: 'Google', contactInfo: '254-555-0456', date: today.subtract(12, 'hour').toISOString() },
    ],
    activeProposals: [
      { customerName: 'Anderson Home', amount: 15200, dateSent: today.subtract(3, 'day').format('YYYY-MM-DD'), followUpDue: today.format('YYYY-MM-DD') },
      { customerName: 'Taylor Residence', amount: 8900, dateSent: today.subtract(5, 'day').format('YYYY-MM-DD'), followUpDue: today.subtract(2, 'day').format('YYYY-MM-DD') },
      { customerName: 'Wilson Project', amount: 22000, dateSent: today.subtract(1, 'day').format('YYYY-MM-DD'), followUpDue: today.add(2, 'day').format('YYYY-MM-DD') },
    ],
    newlySoldJobs: [
      {
        customerName: 'Brown Residence',
        address: '2468 Maple Ave, Waco TX',
        scope: 'Full backyard turf install — 1,800 sqft premium turf, putting green 200 sqft',
        amount: 12800,
        designId: 'design-001',
        installDate: today.add(10, 'day').format('YYYY-MM-DD'),
      },
    ],
    productionPipeline: [
      { customerName: 'Chen Backyard', status: 'Scheduled', scheduledDate: today.add(2, 'day').format('YYYY-MM-DD'), assignedTo: 'Trevor' },
      { customerName: 'Lee Landscape', status: 'In Production', scheduledDate: today.add(1, 'day').format('YYYY-MM-DD'), assignedTo: 'Trevor' },
    ],
    salesMetrics: {
      pipelineValue: 46100,
      leadsThisWeek: 8,
      appointmentsThisWeek: 5,
      proposalsSent: 3,
      jobsSold: 1,
      conversionRate: 12,
    },
    _mock: true,
  };
}

async function collect() {
  log.info('Collecting Builder Prime data...');

  if (!config.builderPrime.apiKey || !config.builderPrime.subdomain) {
    log.warn('Builder Prime not configured, returning mock data');
    return getMockData();
  }

  try {
    return await collectLive();
  } catch (err) {
    log.error('Builder Prime collection failed, returning mock data', { error: err.message });
    return { ...getMockData(), _error: err.message };
  }
}

module.exports = { collect };
