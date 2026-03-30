const crypto = require('crypto');

const BASE_URL = 'https://graph.facebook.com/v19.0';

function getAccessToken() {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error('META_ACCESS_TOKEN environment variable is not configured');
  }
  return token;
}

function getAdAccountId() {
  const id = process.env.META_AD_ACCOUNT_ID;
  if (!id) {
    throw new Error('META_AD_ACCOUNT_ID environment variable is not configured');
  }
  return id;
}

function sha256(value) {
  if (!value) return '';
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

async function request(method, path, body = null) {
  const url = `${BASE_URL}${path}`;

  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  // Attach access token
  const tokenParam = `access_token=${getAccessToken()}`;
  const separator = url.includes('?') ? '&' : '?';
  const fullUrl = `${url}${separator}${tokenParam}`;

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(fullUrl, options);
    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || JSON.stringify(data);
      console.error(`Meta API error [${method} ${path}]: ${response.status} - ${errMsg}`);
      throw new Error(`Meta API error: ${response.status} - ${errMsg}`);
    }

    return data;
  } catch (err) {
    if (err.message.startsWith('Meta API error')) throw err;
    console.error(`Meta request failed [${method} ${path}]:`, err.message);
    throw err;
  }
}

/**
 * Create a Custom Audience for property targeting.
 */
async function createCustomAudience(name, description) {
  const adAccountId = getAdAccountId();
  return request('POST', `/${adAccountId}/customaudiences`, {
    name,
    description,
    subtype: 'CUSTOM',
    customer_file_source: 'USER_PROVIDED_ONLY',
  });
}

/**
 * Upload hashed user data to a Custom Audience.
 * @param {string} audienceId - The audience ID
 * @param {Array<{fn, ln, st, ct, zip, country}>} users - User data to hash and upload
 */
async function uploadAudienceData(audienceId, users) {
  const hashedData = users.map((user) => [
    sha256(user.fn),
    sha256(user.ln),
    sha256(user.st),
    sha256(user.ct),
    sha256(user.zip),
    sha256(user.country),
  ]);

  const payload = {
    payload: {
      schema: ['FN', 'LN', 'ST', 'CT', 'ZIP', 'COUNTRY'],
      data: hashedData,
    },
  };

  return request('POST', `/${audienceId}/users`, payload);
}

/**
 * Create a campaign with housing special ad category.
 */
async function createCampaign(name, dailyBudget, objective) {
  const adAccountId = getAdAccountId();
  return request('POST', `/${adAccountId}/campaigns`, {
    name,
    objective: objective || 'OUTCOME_AWARENESS',
    status: 'PAUSED',
    special_ad_categories: ['HOUSING'],
    daily_budget: dailyBudget,
  });
}

/**
 * Create an ad set with custom audience and geo targeting.
 */
async function createAdSet(campaignId, audienceId, name, dailyBudget, geo) {
  const adAccountId = getAdAccountId();
  return request('POST', `/${adAccountId}/adsets`, {
    campaign_id: campaignId,
    name,
    daily_budget: dailyBudget,
    optimization_goal: 'REACH',
    billing_event: 'IMPRESSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: {
      custom_audiences: [{ id: audienceId }],
      geo_locations: geo,
    },
    status: 'PAUSED',
  });
}

/**
 * Create an ad creative for a link ad.
 */
async function createAdCreative(pageId, message, headline, description, linkUrl, imageUrl) {
  const adAccountId = getAdAccountId();
  return request('POST', `/${adAccountId}/adcreatives`, {
    name: headline,
    object_story_spec: {
      page_id: pageId,
      link_data: {
        message,
        link: linkUrl,
        name: headline,
        description,
        image_url: imageUrl,
      },
    },
  });
}

/**
 * Create an ad linking ad set and creative.
 */
async function createAd(adSetId, creativeId, name) {
  const adAccountId = getAdAccountId();
  return request('POST', `/${adAccountId}/ads`, {
    name,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: 'PAUSED',
  });
}

/**
 * Get campaign performance insights.
 */
async function getCampaignInsights(campaignId) {
  return request('GET', `/${campaignId}/insights?fields=reach,impressions,clicks,actions`);
}

/**
 * Update campaign status (ACTIVE or PAUSED).
 */
async function updateCampaignStatus(campaignId, status) {
  return request('POST', `/${campaignId}`, { status });
}

/**
 * Get pre-built ad copy templates for pool services.
 */
function getAdTemplates() {
  return [
    {
      id: 0,
      name: 'Neighborhood Trust',
      primary_text:
        'Your neighbors already trust us with their pool. We service multiple homes in your area and would love to help keep your pool crystal clear too. Ask about our neighborhood discount!',
      headline: 'Your Neighbors Love Their Pool Service',
      description:
        'Trusted by homeowners in your neighborhood. Schedule your free pool evaluation today.',
    },
    {
      id: 1,
      name: 'Pool Season',
      primary_text:
        'Pool season is right around the corner! Get ahead of the rush and make sure your pool is swim-ready. Our certified technicians handle everything from opening to weekly maintenance.',
      headline: 'Get Your Pool Ready for the Season',
      description:
        'Professional pool service starting at affordable rates. Book now before the schedule fills up.',
    },
    {
      id: 2,
      name: 'Already Nearby',
      primary_text:
        "We're already servicing pools on your street! Since our team is in your neighborhood, we can offer you priority scheduling and reduced rates. Let us show you the difference professional pool care makes.",
      headline: "We're Already in Your Neighborhood",
      description:
        'Save time and money with a pool service that is already nearby. Get a free quote today.',
    },
  ];
}

module.exports = {
  createCustomAudience,
  uploadAudienceData,
  createCampaign,
  createAdSet,
  createAdCreative,
  createAd,
  getCampaignInsights,
  updateCampaignStatus,
  getAdTemplates,
};
