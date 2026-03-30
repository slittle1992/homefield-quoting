const BASE_URL = 'https://services.leadconnectorhq.com';

function getHeaders() {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    throw new Error('GHL_API_KEY environment variable is not configured');
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  };
}

function getLocationId() {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) {
    throw new Error('GHL_LOCATION_ID environment variable is not configured');
  }
  return locationId;
}

async function request(method, path, body = null, queryParams = null) {
  const url = new URL(`${BASE_URL}${path}`);
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const options = {
    method,
    headers: getHeaders(),
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url.toString(), options);
    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.message || data.error || JSON.stringify(data);
      console.error(`GHL API error [${method} ${path}]: ${response.status} - ${errMsg}`);
      throw new Error(`GHL API error: ${response.status} - ${errMsg}`);
    }

    return data;
  } catch (err) {
    if (err.message.startsWith('GHL API error')) throw err;
    console.error(`GHL request failed [${method} ${path}]:`, err.message);
    throw err;
  }
}

/**
 * Create a new contact in GoHighLevel.
 */
async function createContact({ firstName, lastName, phone, email, address1, city, state, postalCode, tags, source }) {
  const body = {
    locationId: getLocationId(),
    firstName,
    lastName,
    phone,
    email,
    address1,
    city,
    state,
    postalCode,
    tags: tags || [],
    source: source || 'PoolDrop',
  };

  const data = await request('POST', '/contacts/', body);
  console.log(`GHL contact created: ${data.contact?.id || data.id}`);
  return data;
}

/**
 * Add a contact to a workflow.
 */
async function addContactToWorkflow(contactId, workflowId) {
  const body = {
    locationId: getLocationId(),
  };

  const data = await request('POST', `/contacts/${contactId}/workflow/${workflowId}`, body);
  console.log(`GHL contact ${contactId} added to workflow ${workflowId}`);
  return data;
}

/**
 * Create an opportunity in a pipeline.
 */
async function createOpportunity({ contactId, pipelineId, stageId, name, monetaryValue }) {
  const body = {
    locationId: getLocationId(),
    contactId,
    pipelineId,
    stageId,
    name,
    monetaryValue,
  };

  const data = await request('POST', '/opportunities/', body);
  console.log(`GHL opportunity created: ${data.opportunity?.id || data.id}`);
  return data;
}

/**
 * Get a contact by ID.
 */
async function getContact(contactId) {
  return request('GET', `/contacts/${contactId}`, null, {
    locationId: getLocationId(),
  });
}

/**
 * Search for a contact by email.
 */
async function searchContactByEmail(email) {
  return request('GET', '/contacts/search', null, {
    locationId: getLocationId(),
    query: email,
  });
}

module.exports = {
  createContact,
  addContactToWorkflow,
  createOpportunity,
  getContact,
  searchContactByEmail,
};
