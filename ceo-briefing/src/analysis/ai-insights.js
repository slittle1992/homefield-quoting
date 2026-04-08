const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');
const { createLogger } = require('../utils/logger');

const log = createLogger('ai-insights');

async function runAnalysis(data) {
  if (!config.anthropic.apiKey) {
    log.warn('Anthropic API key not configured, returning placeholder analysis');
    return getPlaceholderAnalysis();
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  const prompt = buildPrompt(data);

  try {
    log.info('Running AI analysis via Claude API...');

    const response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0]?.text || '';
    log.info('AI analysis complete', { tokenUsage: response.usage });
    return content;
  } catch (err) {
    log.error('AI analysis failed', { error: err.message });
    return getPlaceholderAnalysis();
  }
}

function buildPrompt(data) {
  // Sanitize data — remove overly large arrays to stay within token limits
  const sanitized = {
    mercury: {
      homefield: {
        currentBalance: data.mercury?.homefield?.currentBalance,
        yesterdayInflows: data.mercury?.homefield?.yesterdayInflows,
        yesterdayOutflows: data.mercury?.homefield?.yesterdayOutflows,
        pendingCount: data.mercury?.homefield?.pendingTransactions?.length || 0,
        weeklyHistory: data.mercury?.homefield?.weeklyHistory?.slice(-6),
        projectedWeeks: data.mercury?.homefield?.projectedWeeks,
        categorizedSpending: data.mercury?.homefield?.categorizedSpending,
      },
      secondPoolCare: {
        currentBalance: data.mercury?.secondPoolCare?.currentBalance,
        yesterdayInflows: data.mercury?.secondPoolCare?.yesterdayInflows,
        yesterdayOutflows: data.mercury?.secondPoolCare?.yesterdayOutflows,
        pendingCount: data.mercury?.secondPoolCare?.pendingTransactions?.length || 0,
        weeklyHistory: data.mercury?.secondPoolCare?.weeklyHistory?.slice(-6),
        projectedWeeks: data.mercury?.secondPoolCare?.projectedWeeks,
      },
    },
    builderPrime: {
      todayAppointments: data.builderPrime?.todayAppointments?.length || 0,
      newLeads: data.builderPrime?.newLeads?.length || 0,
      activeProposals: data.builderPrime?.activeProposals,
      newlySoldJobs: data.builderPrime?.newlySoldJobs,
      salesMetrics: data.builderPrime?.salesMetrics,
      productionPipeline: data.builderPrime?.productionPipeline,
    },
    gusto: {
      nextPayroll: data.gusto?.nextPayroll,
      lastPayroll: data.gusto?.lastPayroll ? { date: data.gusto.lastPayroll.date, total: data.gusto.lastPayroll.total } : null,
      ytdTotal: data.gusto?.ytdTotal,
      alerts: data.gusto?.alerts,
    },
    poolBrain: {
      todayRouteCount: data.poolBrain?.todayRoutes?.length || 0,
      completionRate: data.poolBrain?.completionRate,
      overdueServices: data.poolBrain?.overdueServices,
      customerAlerts: data.poolBrain?.customerAlerts,
      weekSchedule: data.poolBrain?.weekSchedule,
    },
    flyers: {
      yesterday: data.flyers?.yesterday,
      thisWeek: data.flyers?.thisWeek,
      thisMonth: data.flyers?.thisMonth,
      conversionTracking: data.flyers?.conversionTracking,
      topNeighborhoods: data.flyers?.topNeighborhoods?.slice(0, 5),
    },
    invoicing: data.invoicing,
    payroll: data.payroll,
    orderDrafts: data.orderDrafts?.length || 0,
  };

  return `You are a fractional CFO and COO analyzing daily business data for a CEO who runs two companies: Homefield Turf (artificial turf installation) and Second Pool Care (pool maintenance).

Here is today's aggregated data:
${JSON.stringify(sanitized, null, 2)}

Provide analysis in the following sections. Format for HTML email consumption (use <h3>, <p>, <ul>, <li> tags). Use 🔴 for critical, 🟡 for warning, 🟢 for positive.

## CRITICAL ALERTS (if any)
- Cash balance below threshold
- Overdue invoices > 30 days
- Missing payroll data
- Stalled sales pipeline
- Operator no-shows or incomplete routes

## CASH FLOW ANALYSIS
- Current position across both businesses
- Recent trend summary (improving, declining, stable)
- 4-week forward projection with confidence level
- Specific weeks where cash may be tight
- Recommended actions if cash is projected to drop below safety threshold

## SALES & MARKETING ANALYSIS (Homefield Turf)
- Pipeline health: enough leads coming in?
- Conversion funnel analysis: where are deals stalling?
- Flyer campaign effectiveness: ROI by neighborhood
- Recommended adjustments to marketing spend or focus areas

## OPERATIONS ANALYSIS
- Homefield: production capacity utilization, scheduling conflicts
- Second Pool Care: route efficiency, service completion rate trends
- Staffing: are operators keeping up with demand?

## REVENUE OPPORTUNITIES
- Jobs that need follow-up
- Proposals going stale (sent 7+ days ago with no response)
- Upsell opportunities based on customer patterns
- Seasonal considerations for the next 30 days

## ACTION ITEMS (prioritized)
- List the top 5 things the CEO should act on TODAY
- Include specific dollar amounts and names where relevant
- Distinguish between urgent (do today) and important (do this week)

Keep the tone direct and actionable. No fluff. Use specific numbers.`;
}

function getPlaceholderAnalysis() {
  return `<h3>🟡 AI Analysis Unavailable</h3>
<p>The AI analysis engine is not configured. Add your <code>ANTHROPIC_API_KEY</code> to the .env file to enable automated insights.</p>
<p>In the meantime, review the data sections above for your daily overview.</p>

<h3>Quick Manual Checklist</h3>
<ul>
<li>Check cash balances — are both accounts above minimum thresholds?</li>
<li>Review any new leads and follow up within 24 hours</li>
<li>Check stale proposals — follow up on anything older than 3 days</li>
<li>Verify today's schedules for Trevor and Steven</li>
<li>Review any overdue invoices</li>
</ul>`;
}

module.exports = { runAnalysis };
