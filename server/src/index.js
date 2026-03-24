require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

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
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
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
app.use('/api/import', importRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/export', exportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Only start listening when run directly (not when imported for tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`PoolDrop server running on port ${PORT}`);
  });
}

module.exports = app;
