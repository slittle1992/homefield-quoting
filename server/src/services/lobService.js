const axios = require('axios');

const LOB_BASE_URL = 'https://api.lob.com/v1';

/**
 * Get axios instance configured for Lob API
 */
function getLobClient() {
  const apiKey = process.env.LOB_API_KEY;
  if (!apiKey) {
    throw new Error('LOB_API_KEY environment variable is not set');
  }

  return axios.create({
    baseURL: LOB_BASE_URL,
    auth: {
      username: apiKey,
      password: '',
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Get default sender address from environment variables
 */
function getDefaultFrom() {
  return {
    name: process.env.COMPANY_NAME || '',
    address_line1: process.env.COMPANY_ADDRESS || '',
    address_city: process.env.COMPANY_CITY || '',
    address_state: process.env.COMPANY_STATE || 'TX',
    address_zip: process.env.COMPANY_ZIP || '',
  };
}

/**
 * Create a postcard via Lob API
 * @param {Object} to - Recipient address { name, address_line1, address_city, address_state, address_zip }
 * @param {Object} from - Sender address (same shape), defaults to getDefaultFrom()
 * @param {string} frontHtml - HTML content for postcard front
 * @param {string} backHtml - HTML content for postcard back
 * @param {string} size - Postcard size: '4x6', '6x9', or '6x11'
 * @returns {Object} Lob postcard response
 */
async function createPostcard(to, from, frontHtml, backHtml, size = '4x6') {
  const client = getLobClient();
  const senderAddress = from || getDefaultFrom();

  const payload = {
    to,
    from: senderAddress,
    front: frontHtml,
    back: backHtml,
    size,
  };

  try {
    const response = await client.post('/postcards', payload);
    return {
      id: response.data.id,
      status: response.data.status,
      url: response.data.url,
      expectedDeliveryDate: response.data.expected_delivery_date,
      cost: response.data.price ? Math.round(parseFloat(response.data.price) * 100) : null,
    };
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message;
    console.error('Lob createPostcard failed:', message);
    throw new Error(`Lob API error: ${message}`);
  }
}

/**
 * Get the status of a postcard by Lob ID
 * @param {string} lobId - Lob postcard ID (e.g. psc_xxxx)
 * @returns {Object} Postcard status info
 */
async function getPostcardStatus(lobId) {
  const client = getLobClient();

  try {
    const response = await client.get(`/postcards/${lobId}`);
    return {
      id: response.data.id,
      status: response.data.status,
      expectedDeliveryDate: response.data.expected_delivery_date,
      sendDate: response.data.send_date,
      url: response.data.url,
    };
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message;
    console.error('Lob getPostcardStatus failed:', message);
    throw new Error(`Lob API error: ${message}`);
  }
}

/**
 * Get pre-built HTML templates for pool service postcards
 * Variables: {{owner_name}}, {{address}}, {{qr_url}}, {{company_name}},
 *            {{company_phone}}, {{company_website}}, {{company_logo_url}}
 */
function getPostcardTemplates() {
  const companyName = process.env.COMPANY_NAME || 'Your Pool Service';
  const companyPhone = process.env.COMPANY_PHONE || '';
  const companyWebsite = process.env.COMPANY_WEBSITE || '';
  const companyLogoUrl = process.env.COMPANY_LOGO_URL || '';

  const front = `<!DOCTYPE html>
<html>
<head>
<style>
  body {
    margin: 0;
    padding: 0;
    font-family: 'Helvetica Neue', Arial, sans-serif;
  }
  .postcard-front {
    width: 6.25in;
    height: 4.25in;
    position: relative;
    background: linear-gradient(135deg, #0077b6 0%, #023e8a 100%);
    color: #ffffff;
    overflow: hidden;
  }
  .pool-photo-placeholder {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(180deg, rgba(0,119,182,0.3) 0%, rgba(2,62,138,0.8) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .headline-container {
    position: relative;
    z-index: 2;
    text-align: center;
    padding: 0.5in 0.4in;
  }
  .headline {
    font-size: 28px;
    font-weight: 700;
    line-height: 1.2;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    margin-bottom: 12px;
  }
  .subheadline {
    font-size: 14px;
    font-weight: 400;
    opacity: 0.9;
  }
  .logo-area {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 3;
  }
  .logo-area img {
    max-height: 50px;
    max-width: 120px;
  }
</style>
</head>
<body>
<div class="postcard-front">
  <div class="pool-photo-placeholder">
    <!-- Replace with actual pool photo URL -->
  </div>
  <div class="headline-container">
    <div class="headline">Your Neighbors Trust Us With Their Pools</div>
    <div class="subheadline">Professional pool service trusted by families in your neighborhood</div>
  </div>
  ${companyLogoUrl ? `<div class="logo-area"><img src="${companyLogoUrl}" alt="${companyName}"></div>` : ''}
</div>
</body>
</html>`;

  const back = `<!DOCTYPE html>
<html>
<head>
<style>
  body {
    margin: 0;
    padding: 0;
    font-family: 'Helvetica Neue', Arial, sans-serif;
  }
  .postcard-back {
    width: 6.25in;
    height: 4.25in;
    padding: 0.3in;
    box-sizing: border-box;
    display: flex;
    gap: 0.2in;
  }
  .content-area {
    flex: 1;
  }
  .greeting {
    font-size: 14px;
    color: #333;
    margin-bottom: 8px;
  }
  .owner-name {
    font-weight: 700;
  }
  .offer-box {
    background: #f0f7ff;
    border: 2px solid #0077b6;
    border-radius: 8px;
    padding: 12px;
    margin: 10px 0;
  }
  .offer-title {
    font-size: 16px;
    font-weight: 700;
    color: #0077b6;
    margin-bottom: 4px;
  }
  .offer-detail {
    font-size: 12px;
    color: #555;
  }
  .services-list {
    font-size: 11px;
    color: #444;
    margin: 8px 0;
    line-height: 1.5;
  }
  .services-list strong {
    color: #0077b6;
  }
  .company-info {
    font-size: 11px;
    color: #666;
    margin-top: 8px;
    border-top: 1px solid #ddd;
    padding-top: 6px;
  }
  .company-name {
    font-weight: 700;
    color: #0077b6;
    font-size: 13px;
  }
  .qr-area {
    width: 1.2in;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .qr-placeholder {
    width: 1in;
    height: 1in;
    border: 2px dashed #0077b6;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #0077b6;
    background: #f9f9f9;
    margin-bottom: 6px;
  }
  .qr-label {
    font-size: 10px;
    color: #666;
  }
</style>
</head>
<body>
<div class="postcard-back">
  <div class="content-area">
    <div class="greeting">
      Hi <span class="owner-name">{{owner_name}}</span>,
    </div>
    <div class="offer-box">
      <div class="offer-title">Free Pool Inspection</div>
      <div class="offer-detail">We're servicing pools in your area near {{address}}. Schedule your complimentary inspection today!</div>
    </div>
    <div class="services-list">
      <strong>Our Services:</strong><br>
      Weekly Pool Cleaning &bull; Equipment Repair &bull; Pool Resurfacing<br>
      Green-to-Clean &bull; Filter Maintenance &bull; Chemical Balancing
    </div>
    <div class="company-info">
      <div class="company-name">${companyName}</div>
      ${companyPhone ? `<div>${companyPhone}</div>` : ''}
      ${companyWebsite ? `<div>${companyWebsite}</div>` : ''}
    </div>
  </div>
  <div class="qr-area">
    <div class="qr-placeholder">
      <!-- Replace src with {{qr_url}} -->
      Scan to<br>Book Now
    </div>
    <div class="qr-label">Scan for a<br>free quote</div>
  </div>
</div>
</body>
</html>`;

  return { front, back };
}

/**
 * Render a template by replacing placeholder variables
 * @param {string} html - Template HTML with {{variable}} placeholders
 * @param {Object} vars - Key-value pairs to substitute
 * @returns {string} Rendered HTML
 */
function renderTemplate(html, vars = {}) {
  let rendered = html;
  for (const [key, value] of Object.entries(vars)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(placeholder, value || '');
  }
  return rendered;
}

module.exports = {
  createPostcard,
  getPostcardStatus,
  getDefaultFrom,
  getPostcardTemplates,
  renderTemplate,
};
