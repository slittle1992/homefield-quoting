const pool = require('../config/database');

/**
 * Start a campaign for a property - set status, schedule first drop
 */
async function startCampaign(propertyId) {
  const today = new Date().toISOString().split('T')[0];

  // Update property campaign status
  await pool.query(`
    UPDATE properties
    SET campaign_status = 'flyer_in_progress',
        campaign_next_drop_date = $1,
        campaign_drops_completed = 0,
        updated_at = NOW()
    WHERE id = $2
  `, [today, propertyId]);

  // Create first drop queue entry
  await pool.query(`
    INSERT INTO drop_queue (property_id, drop_number, scheduled_date, priority, status)
    VALUES ($1, 1, $2, 10, 'queued')
  `, [propertyId, today]);

  return { propertyId, nextDropDate: today, dropNumber: 1 };
}

/**
 * Schedule the next drop after a completed drop
 */
async function scheduleNextDrop(propertyId, completedDropNumber) {
  const nextDropNumber = completedDropNumber + 1;

  // Look up campaign schedule for next drop
  const scheduleResult = await pool.query(
    'SELECT days_after_previous FROM campaign_schedule WHERE drop_number = $1',
    [nextDropNumber]
  );

  if (scheduleResult.rows.length === 0) {
    // No schedule entry for this drop number - campaign complete
    await pool.query(`
      UPDATE properties
      SET campaign_drops_completed = $1,
          campaign_status = 'flyer_complete',
          campaign_next_drop_date = NULL,
          updated_at = NOW()
      WHERE id = $2
    `, [completedDropNumber, propertyId]);
    return null;
  }

  const daysAfter = scheduleResult.rows[0].days_after_previous;
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + daysAfter);
  const nextDateStr = nextDate.toISOString().split('T')[0];

  await pool.query(`
    UPDATE properties
    SET campaign_drops_completed = $1,
        campaign_status = 'flyer_in_progress',
        campaign_next_drop_date = $2,
        updated_at = NOW()
    WHERE id = $3
  `, [completedDropNumber, nextDateStr, propertyId]);

  return { propertyId, nextDropDate: nextDateStr, dropNumber: nextDropNumber };
}

/**
 * Check for flyer_complete properties that haven't converted and escalate to mailers
 */
async function checkMailerEscalation() {
  const mailerEnabled = process.env.MAILER_ENABLED === 'true';
  if (!mailerEnabled) {
    return { escalated: 0, message: 'Mailer escalation is disabled' };
  }

  // Find flyer_complete properties not converted and not already in mailer flow
  const result = await pool.query(`
    SELECT p.id, p.mailer_drops_completed, p.mailer_total_drops
    FROM properties p
    WHERE p.campaign_status = 'flyer_complete'
      AND p.converted_at IS NULL
      AND p.do_not_drop = false
      AND NOT EXISTS (
        SELECT 1 FROM mailer_queue mq
        WHERE mq.property_id = p.id AND mq.status IN ('queued', 'sent')
      )
  `);

  let escalated = 0;

  for (const prop of result.rows) {
    if (prop.mailer_drops_completed >= prop.mailer_total_drops) {
      continue; // Already completed all mailers
    }

    const nextMailerNumber = prop.mailer_drops_completed + 1;

    // Look up mailer schedule
    const scheduleResult = await pool.query(
      'SELECT days_after_previous FROM mailer_schedule WHERE mailer_number = $1',
      [nextMailerNumber]
    );

    if (scheduleResult.rows.length === 0) continue;

    const daysAfter = scheduleResult.rows[0].days_after_previous;
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + daysAfter);
    const scheduledDateStr = scheduledDate.toISOString().split('T')[0];

    // Get mailer config for template
    const configResult = await pool.query(
      'SELECT default_template_id, cost_per_piece_cents, provider FROM mailer_config WHERE is_active = true LIMIT 1'
    );

    const config = configResult.rows.length > 0 ? configResult.rows[0] : {};

    await pool.query(`
      INSERT INTO mailer_queue (property_id, mailer_number, scheduled_date, template_id, cost_cents, provider)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      prop.id,
      nextMailerNumber,
      scheduledDateStr,
      config.default_template_id || null,
      config.cost_per_piece_cents || null,
      config.provider || null,
    ]);

    // Update property status
    await pool.query(`
      UPDATE properties
      SET campaign_status = 'mailer_in_progress', updated_at = NOW()
      WHERE id = $1
    `, [prop.id]);

    escalated++;
  }

  return { escalated, message: `Escalated ${escalated} properties to mailer flow` };
}

module.exports = {
  startCampaign,
  scheduleNextDrop,
  checkMailerEscalation,
};
