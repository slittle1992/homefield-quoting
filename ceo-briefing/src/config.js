const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = {
  // Mercury Bank (Homefield Turf)
  mercury: {
    homefield: {
      apiToken: process.env.MERCURY_HT_API_TOKEN,
      accountId: process.env.MERCURY_HT_ACCOUNT_ID,
    },
    secondPoolCare: {
      apiToken: process.env.MERCURY_SPC_API_TOKEN,
      accountId: process.env.MERCURY_SPC_ACCOUNT_ID,
    },
    baseUrl: 'https://api.mercury.com/api/v1',
  },

  // Builder Prime
  builderPrime: {
    apiKey: process.env.BUILDERPRIME_API_KEY,
    subdomain: process.env.BUILDERPRIME_SUBDOMAIN,
    get baseUrl() {
      return `https://${this.subdomain}.builderprime.com/api`;
    },
  },

  // Gusto
  gusto: {
    clientId: process.env.GUSTO_CLIENT_ID,
    clientSecret: process.env.GUSTO_CLIENT_SECRET,
    refreshToken: process.env.GUSTO_REFRESH_TOKEN,
    companyId: process.env.GUSTO_COMPANY_ID,
    baseUrl: 'https://api.gusto.com/v1',
    tokenUrl: 'https://api.gusto.com/oauth/token',
  },

  // Pool Brain
  poolBrain: {
    apiKey: process.env.POOLBRAIN_API_KEY,
    baseUrl: process.env.POOLBRAIN_BASE_URL || 'https://prodapi.poolbrain.com',
  },

  // PoolDrop (PostgreSQL)
  poolDrop: {
    databaseUrl: process.env.POOLDROP_DATABASE_URL,
  },

  // Claude API
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
  },

  // Gmail
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    senderEmail: process.env.GMAIL_SENDER_EMAIL,
  },

  // Recipients
  recipients: {
    ceo: process.env.CEO_EMAIL,
    trevor: process.env.TREVOR_EMAIL,
    steven: process.env.STEVEN_EMAIL,
  },

  // Design Tool
  designTool: {
    dataPath: process.env.DESIGN_TOOL_DATA_PATH || path.join(__dirname, '..', 'data', 'designs'),
  },

  // Supplier
  supplier: {
    email: process.env.SUPPLIER_1_EMAIL,
    name: process.env.SUPPLIER_1_NAME,
  },

  // Runtime flags
  isTest: process.argv.includes('--test'),
  isNow: process.argv.includes('--now'),
};

module.exports = config;
