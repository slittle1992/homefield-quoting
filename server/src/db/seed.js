require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');

    // Insert default campaign schedule
    await client.query(`
      INSERT INTO campaign_schedule (drop_number, days_after_previous)
      VALUES (1, 0), (2, 14), (3, 16), (4, 30)
      ON CONFLICT (drop_number) DO UPDATE SET days_after_previous = EXCLUDED.days_after_previous
    `);
    console.log('Campaign schedule seeded.');

    // Insert default mailer schedule
    await client.query(`
      INSERT INTO mailer_schedule (mailer_number, days_after_previous)
      VALUES (1, 7), (2, 21), (3, 21)
      ON CONFLICT (mailer_number) DO UPDATE SET days_after_previous = EXCLUDED.days_after_previous
    `);
    console.log('Mailer schedule seeded.');

    // Create default admin user
    const adminHash = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Admin', 'admin@pooldrop.com', $1, 'admin')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `, [adminHash]);
    console.log('Default admin user seeded (admin@pooldrop.com / admin123).');

    // Create default driver user
    const driverHash = await bcrypt.hash('driver123', 10);
    await client.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Driver', 'driver@pooldrop.com', $1, 'driver')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `, [driverHash]);
    console.log('Default driver user seeded (driver@pooldrop.com / driver123).');

    console.log('Seeding completed successfully.');
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
