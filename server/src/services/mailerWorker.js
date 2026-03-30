const cron = require('node-cron');
const pool = require('../config/database');
const lobService = require('./lobService');
const { checkMailerEscalation } = require('./campaignService');

/**
 * Process queued mailers that are due for sending
 */
async function processMailerQueue() {
  const today = new Date().toISOString().split('T')[0];

  let items;
  try {
    const result = await pool.query(`
      SELECT mq.id, mq.property_id, mq.mailer_number, mq.template_id,
             p.address, p.city, p.state, p.zip, p.owner_name
      FROM mailer_queue mq
      JOIN properties p ON p.id = mq.property_id
      WHERE mq.status = 'queued'
        AND mq.scheduled_date <= $1
      ORDER BY mq.scheduled_date ASC
      LIMIT 50
    `, [today]);
    items = result.rows;
  } catch (err) {
    console.error('Mailer worker: failed to query mailer_queue:', err.message);
    return;
  }

  if (items.length === 0) {
    return;
  }

  console.log(`Mailer worker: processing ${items.length} queued mailer(s)`);

  const templates = lobService.getPostcardTemplates();
  const senderAddress = lobService.getDefaultFrom();

  for (const item of items) {
    try {
      const recipientAddress = {
        name: item.owner_name || 'Current Resident',
        address_line1: item.address,
        address_city: item.city || '',
        address_state: item.state || 'TX',
        address_zip: item.zip || '',
      };

      const templateVars = {
        owner_name: item.owner_name || 'Neighbor',
        address: item.address || '',
        qr_url: process.env.COMPANY_WEBSITE || '',
      };

      const frontHtml = lobService.renderTemplate(templates.front, templateVars);
      const backHtml = lobService.renderTemplate(templates.back, templateVars);

      const result = await lobService.createPostcard(
        recipientAddress,
        senderAddress,
        frontHtml,
        backHtml,
        '4x6'
      );

      await pool.query(`
        UPDATE mailer_queue
        SET status = 'sent',
            provider = 'lob',
            provider_mail_id = $1,
            cost_cents = $2,
            sent_at = NOW()
        WHERE id = $3
      `, [result.id, result.cost, item.id]);

      // Update mailer_drops_completed on property
      await pool.query(`
        UPDATE properties
        SET mailer_drops_completed = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [item.mailer_number, item.property_id]);

      console.log(`Mailer worker: sent postcard for property ${item.property_id} (Lob ID: ${result.id})`);
    } catch (err) {
      console.error(`Mailer worker: failed to send mailer ${item.id} for property ${item.property_id}:`, err.message);

      // Mark as failed so it doesn't retry indefinitely
      await pool.query(`
        UPDATE mailer_queue
        SET status = 'failed',
            provider = 'lob'
        WHERE id = $1
      `, [item.id]).catch(updateErr => {
        console.error('Mailer worker: failed to update status to failed:', updateErr.message);
      });
    }
  }
}

/**
 * Run the full mailer worker cycle: escalate then process queue
 */
async function runMailerCycle() {
  try {
    // First, escalate flyer_complete properties to mailer queue
    const escalationResult = await checkMailerEscalation();
    if (escalationResult.escalated > 0) {
      console.log(`Mailer worker: ${escalationResult.message}`);
    }
  } catch (err) {
    console.error('Mailer worker: escalation check failed:', err.message);
  }

  try {
    // Then, process any queued mailers that are due
    await processMailerQueue();
  } catch (err) {
    console.error('Mailer worker: queue processing failed:', err.message);
  }
}

/**
 * Start the mailer worker cron job (runs every hour)
 */
function startMailerWorker() {
  if (process.env.MAILER_ENABLED !== 'true') {
    console.log('Mailer worker: disabled (MAILER_ENABLED is not true)');
    return null;
  }

  console.log('Mailer worker: scheduling hourly cron job');

  // Run every hour at minute 0
  const task = cron.schedule('0 * * * *', async () => {
    console.log(`Mailer worker: running cycle at ${new Date().toISOString()}`);
    await runMailerCycle();
  });

  // Run once on startup after a short delay
  setTimeout(() => {
    console.log('Mailer worker: running initial cycle');
    runMailerCycle();
  }, 5000);

  return task;
}

module.exports = {
  startMailerWorker,
  processMailerQueue,
  runMailerCycle,
};
