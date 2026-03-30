const express = require('express');
const pool = require('../config/database');
const ghlService = require('../services/ghlService');

const router = express.Router();

/**
 * Validate webhook secret from query param or header.
 */
function validateWebhookSecret(req, res, next) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    console.warn('WEBHOOK_SECRET not configured, skipping validation');
    return next();
  }

  const provided =
    req.query.secret ||
    req.headers['x-webhook-secret'] ||
    req.headers['x-hub-signature'];

  if (provided !== secret) {
    console.warn('Webhook secret mismatch');
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  next();
}

// POST /api/webhooks/meta-lead - Meta Lead Form submissions
router.post('/meta-lead', validateWebhookSecret, async (req, res) => {
  try {
    const { full_name, email, phone_number } = req.body;

    if (!full_name && !email && !phone_number) {
      return res.status(400).json({ error: 'Missing lead data' });
    }

    // Parse name
    let firstName = '';
    let lastName = '';
    if (full_name) {
      const parts = full_name.trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    // Create GHL contact
    const contact = await ghlService.createContact({
      firstName,
      lastName,
      phone: phone_number || '',
      email: email || '',
      tags: ['meta_lead', 'pool_service'],
      source: 'Meta Lead Ad',
    });

    const contactId = contact.contact?.id || contact.id;

    // Check if a GHL workflow is configured
    try {
      const integrationResult = await pool.query(
        "SELECT value FROM integrations WHERE key = 'ghl_workflow_id'"
      );
      if (integrationResult.rows.length > 0 && integrationResult.rows[0].value) {
        await ghlService.addContactToWorkflow(contactId, integrationResult.rows[0].value);
      }
    } catch (wfErr) {
      console.error('Failed to add contact to workflow:', wfErr.message);
    }

    console.log(`Meta lead processed: ${email || full_name}`);
    res.status(200).json({ success: true, contactId });
  } catch (err) {
    console.error('Meta lead webhook error:', err);
    res.status(200).json({ success: false, error: err.message });
  }
});

// POST /api/webhooks/qr-scan - QR code landing page form submissions
router.post('/qr-scan', validateWebhookSecret, async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;

    if (!name && !email && !phone) {
      return res.status(400).json({ error: 'Missing lead data' });
    }

    let firstName = '';
    let lastName = '';
    if (name) {
      const parts = name.trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    const contact = await ghlService.createContact({
      firstName,
      lastName,
      phone: phone || '',
      email: email || '',
      address1: address || '',
      tags: ['qr_scan', 'mailer_lead'],
      source: 'QR Code Scan',
    });

    const contactId = contact.contact?.id || contact.id;
    console.log(`QR scan lead processed: ${email || name}`);
    res.status(200).json({ success: true, contactId });
  } catch (err) {
    console.error('QR scan webhook error:', err);
    res.status(200).json({ success: false, error: err.message });
  }
});

// POST /api/webhooks/ghl - GHL status update events
router.post('/ghl', validateWebhookSecret, async (req, res) => {
  try {
    const { event, contact, data } = req.body;

    if (!event) {
      return res.status(400).json({ error: 'Missing event type' });
    }

    console.log(`GHL webhook event: ${event}`);

    if (event === 'appointment_booked') {
      console.log(`Appointment booked for contact: ${contact?.email || contact?.id || 'unknown'}`);
    }

    if (event === 'deal_won') {
      const email = contact?.email || data?.email;
      const address = contact?.address1 || data?.address;

      if (email || address) {
        // Try to find matching property by email or address
        let matchQuery = '';
        const matchParams = [];
        let paramIndex = 1;

        if (email) {
          matchQuery = `owner_email = $${paramIndex++}`;
          matchParams.push(email);
        }

        if (address) {
          if (matchQuery) matchQuery += ' OR ';
          matchQuery += `address ILIKE $${paramIndex++}`;
          matchParams.push(`%${address}%`);
        }

        const propertyResult = await pool.query(
          `SELECT id FROM properties WHERE ${matchQuery} LIMIT 1`,
          matchParams
        );

        if (propertyResult.rows.length > 0) {
          const propertyId = propertyResult.rows[0].id;
          await pool.query(
            `UPDATE properties SET campaign_status = 'converted', updated_at = NOW() WHERE id = $1`,
            [propertyId]
          );
          console.log(`Property ${propertyId} marked as converted from GHL deal_won`);
        } else {
          console.log('No matching property found for deal_won event');
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('GHL webhook error:', err);
    res.status(200).json({ success: false, error: err.message });
  }
});

module.exports = router;
