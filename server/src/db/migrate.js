require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pool = require('../config/database');

const schema = `
CREATE EXTENSION IF NOT EXISTS postgis;

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT DEFAULT 'TX',
  zip TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  geom GEOGRAPHY(POINT, 4326),
  owner_name TEXT,
  property_value INTEGER,
  year_built INTEGER,
  subdivision TEXT,
  pool_type TEXT,
  lead_source TEXT,
  mls_listing_id TEXT,
  mls_status TEXT,
  mls_status_date TIMESTAMP,
  do_not_drop BOOLEAN DEFAULT false,
  campaign_total_drops INTEGER DEFAULT 4,
  campaign_drops_completed INTEGER DEFAULT 0,
  campaign_status TEXT DEFAULT 'not_started',
  campaign_next_drop_date DATE,
  mailer_drops_completed INTEGER DEFAULT 0,
  mailer_total_drops INTEGER DEFAULT 3,
  fb_exported_at TIMESTAMP,
  converted_at TIMESTAMP,
  conversion_channel TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(address, zip)
);

-- Drop queue
CREATE TABLE IF NOT EXISTS drop_queue (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id),
  drop_number INTEGER NOT NULL,
  scheduled_date DATE NOT NULL,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'queued',
  assigned_driver_id INTEGER,
  delivered_at TIMESTAMP,
  delivery_lat DECIMAL(10, 7),
  delivery_lng DECIMAL(10, 7),
  delivery_distance_meters DECIMAL(6, 1),
  delivery_photo_url TEXT,
  delivery_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Drivers
CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  password_hash TEXT,
  is_active BOOLEAN DEFAULT true
);

-- Users (admin)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW()
);

-- MLS sync log
CREATE TABLE IF NOT EXISTS mls_sync_log (
  id SERIAL PRIMARY KEY,
  synced_at TIMESTAMP DEFAULT NOW(),
  new_pending INTEGER DEFAULT 0,
  total_processed INTEGER DEFAULT 0,
  errors TEXT
);

-- Mailer queue
CREATE TABLE IF NOT EXISTS mailer_queue (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id),
  mailer_number INTEGER NOT NULL,
  scheduled_date DATE NOT NULL,
  status TEXT DEFAULT 'queued',
  provider TEXT,
  provider_mail_id TEXT,
  template_id TEXT,
  cost_cents INTEGER,
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Conversions
CREATE TABLE IF NOT EXISTS conversions (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id),
  drop_queue_id INTEGER REFERENCES drop_queue(id),
  mailer_queue_id INTEGER REFERENCES mailer_queue(id),
  customer_name TEXT,
  service_type TEXT,
  revenue DECIMAL(10, 2),
  conversion_channel TEXT,
  converted_at TIMESTAMP DEFAULT NOW()
);

-- Facebook export log
CREATE TABLE IF NOT EXISTS fb_export_log (
  id SERIAL PRIMARY KEY,
  exported_at TIMESTAMP DEFAULT NOW(),
  total_addresses INTEGER,
  filter_criteria JSONB,
  filename TEXT
);

CREATE TABLE IF NOT EXISTS fb_export_properties (
  id SERIAL PRIMARY KEY,
  export_id INTEGER REFERENCES fb_export_log(id),
  property_id INTEGER REFERENCES properties(id)
);

-- Mailer config
CREATE TABLE IF NOT EXISTS mailer_config (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  api_key TEXT,
  api_base_url TEXT,
  postcard_size TEXT DEFAULT '4x6',
  default_template_id TEXT,
  is_active BOOLEAN DEFAULT true,
  cost_per_piece_cents INTEGER DEFAULT 77
);

-- Campaign schedule
CREATE TABLE IF NOT EXISTS campaign_schedule (
  drop_number INTEGER PRIMARY KEY,
  days_after_previous INTEGER NOT NULL
);

-- Mailer schedule
CREATE TABLE IF NOT EXISTS mailer_schedule (
  mailer_number INTEGER PRIMARY KEY,
  days_after_previous INTEGER NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_properties_geom ON properties USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_properties_subdivision ON properties(subdivision);
CREATE INDEX IF NOT EXISTS idx_properties_campaign ON properties(campaign_status, campaign_next_drop_date);
CREATE INDEX IF NOT EXISTS idx_drop_queue_date ON drop_queue(scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_mailer_queue_date ON mailer_queue(scheduled_date, status);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    await client.query(schema);
    console.log('Migrations completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
