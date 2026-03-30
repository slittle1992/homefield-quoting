require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const { authenticate } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const propertiesRoutes = require('./routes/properties');
const dropsRoutes = require('./routes/drops');
const importRoutes = require('./routes/import');
const driversRoutes = require('./routes/drivers');
const campaignsRoutes = require('./routes/campaigns');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000'),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/drops', dropsRoutes);
app.use('/api/deliveries', dropsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/export', exportRoutes);

// Debug endpoint to check property/drop state
app.get('/api/debug', authenticate, async (req, res) => {
  const pool = require('./config/database');
  const propStats = await pool.query(`
    SELECT campaign_status, campaign_next_drop_date, do_not_drop,
           campaign_drops_completed, campaign_total_drops, COUNT(*) as count
    FROM properties
    GROUP BY campaign_status, campaign_next_drop_date, do_not_drop,
             campaign_drops_completed, campaign_total_drops
  `);
  const dropStats = await pool.query(`
    SELECT status, assigned_driver_id, scheduled_date, COUNT(*) as count
    FROM drop_queue
    GROUP BY status, assigned_driver_id, scheduled_date
  `);
  const users = await pool.query(`SELECT id, name, email, role FROM users`);
  res.json({
    properties: propStats.rows,
    drops: dropStats.rows,
    users: users.rows,
  });
});

// Config (requires login)
app.get('/api/config', authenticate, (req, res) => {
  res.json({ mapboxToken: process.env.MAPBOX_ACCESS_TOKEN || '' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  // Try multiple possible dist locations
  const possiblePaths = [
    path.join(__dirname, '..', '..', 'dist'),
    path.join(process.cwd(), 'dist'),
    '/app/dist',
  ];
  const fs = require('fs');
  const distPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
  console.log('Serving frontend from:', distPath);
  app.use(express.static(distPath));
  // Only catch non-API routes for SPA fallback
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Only start listening when run directly (not when imported for tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`PoolDrop server running on port ${PORT}`);

    // Start mailer worker if enabled
    if (process.env.MAILER_ENABLED === 'true') {
      const { startMailerWorker } = require('./services/mailerWorker');
      startMailerWorker();
      console.log('Mailer worker started');
    }
  });
}

module.exports = app;
