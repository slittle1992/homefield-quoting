const { mockQuery } = require('./setup');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../src/index');

function adminToken() {
  return jwt.sign(
    { id: 1, email: 'admin@pooldrop.com', name: 'Admin', role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function driverToken() {
  return jwt.sign(
    { id: 10, email: 'driver@pooldrop.com', name: 'Driver', role: 'driver' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Drops Routes', () => {
  describe('GET /api/drops/today', () => {
    it('should return today\'s drops for admin', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1, property_id: 1, drop_number: 1, scheduled_date: '2026-03-24',
            status: 'queued', address: '123 Main St', city: 'Cedar Park',
            lead_source: 'wcad', campaign_drops_completed: 0, campaign_total_drops: 4,
          },
        ],
      });

      const res = await request(app)
        .get('/api/drops/today')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.drops).toHaveLength(1);
      expect(res.body.drops[0].address).toBe('123 Main St');
    });

    it('should filter by driver for driver role', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/drops/today')
        .set('Authorization', `Bearer ${driverToken()}`);

      expect(res.status).toBe(200);
      // Should include assigned_driver_id condition
      const queryStr = mockQuery.mock.calls[0][0];
      expect(queryStr).toMatch(/assigned_driver_id/);
      expect(mockQuery.mock.calls[0][1]).toContain(10); // driver id
    });
  });

  describe('POST /api/drops/generate', () => {
    it('should generate daily drops with priority ordering', async () => {
      // Return eligible properties
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, lead_source: 'mls', campaign_drops_completed: 0, campaign_total_drops: 4 },
          { id: 2, lead_source: 'wcad', campaign_drops_completed: 2, campaign_total_drops: 4 },
          { id: 3, lead_source: 'manual_spotted', campaign_drops_completed: 0, campaign_total_drops: 4 },
        ],
      });

      // Mock the INSERT for each drop
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 10, property_id: 1, drop_number: 1, priority: 30 }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 11, property_id: 2, drop_number: 3, priority: 20 }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 12, property_id: 3, drop_number: 1, priority: 10 }] });

      const res = await request(app)
        .post('/api/drops/generate')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.generated_count).toBe(3);
      expect(res.body.total_eligible).toBe(3);

      // First insert should be the MLS lead (highest priority)
      const firstInsertParams = mockQuery.mock.calls[1][1];
      expect(firstInsertParams[0]).toBe(1); // MLS property id
      expect(firstInsertParams[3]).toBe(30); // MLS priority
    });

    it('should cap at daily limit', async () => {
      // Generate 55 eligible properties
      const properties = Array.from({ length: 55 }, (_, i) => ({
        id: i + 1,
        lead_source: 'wcad',
        campaign_drops_completed: 0,
        campaign_total_drops: 4,
      }));
      mockQuery.mockResolvedValueOnce({ rows: properties });

      // Mock INSERT for each (only 50 should be inserted)
      for (let i = 0; i < 50; i++) {
        mockQuery.mockResolvedValueOnce({
          rows: [{ id: i + 100, property_id: i + 1, drop_number: 1, priority: 10 }],
        });
      }

      const res = await request(app)
        .post('/api/drops/generate')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.generated_count).toBe(50);
      expect(res.body.total_eligible).toBe(55);
      expect(res.body.daily_limit).toBe(50);
    });

    it('should require admin role', async () => {
      const res = await request(app)
        .post('/api/drops/generate')
        .set('Authorization', `Bearer ${driverToken()}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/drops/:id/deliver', () => {
    it('should mark drop as delivered and schedule next drop', async () => {
      // Get drop
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, property_id: 1, drop_number: 1 }],
      });
      // Get property
      mockQuery.mockResolvedValueOnce({
        rows: [{ latitude: 30.51, longitude: -97.82, campaign_total_drops: 4 }],
      });
      // Calculate distance
      mockQuery.mockResolvedValueOnce({ rows: [{ distance: 15.3 }] });
      // Update drop
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'delivered', delivered_at: new Date() }],
      });
      // scheduleNextDrop: look up campaign_schedule
      mockQuery.mockResolvedValueOnce({
        rows: [{ days_after_previous: 14 }],
      });
      // scheduleNextDrop: update property
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/drops/1/deliver')
        .set('Authorization', `Bearer ${driverToken()}`)
        .send({ delivery_lat: 30.5102, delivery_lng: -97.8198 });

      expect(res.status).toBe(200);
      expect(res.body.drop.status).toBe('delivered');
    });

    it('should mark campaign complete when last drop delivered', async () => {
      // Get drop (drop 4 of 4)
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 4, property_id: 1, drop_number: 4 }],
      });
      // Get property
      mockQuery.mockResolvedValueOnce({
        rows: [{ latitude: 30.51, longitude: -97.82, campaign_total_drops: 4 }],
      });
      // Distance calc
      mockQuery.mockResolvedValueOnce({ rows: [{ distance: 10.0 }] });
      // Update drop
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 4, status: 'delivered', delivered_at: new Date() }],
      });
      // Update property to flyer_complete
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/drops/4/deliver')
        .set('Authorization', `Bearer ${driverToken()}`)
        .send({ delivery_lat: 30.51, delivery_lng: -97.82 });

      expect(res.status).toBe(200);
      // Verify property was updated to flyer_complete
      const updateCall = mockQuery.mock.calls[4];
      expect(updateCall[0]).toMatch(/flyer_complete/);
    });

    it('should return 404 for non-existent drop', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/drops/999/deliver')
        .set('Authorization', `Bearer ${driverToken()}`)
        .send({ delivery_lat: 30.51, delivery_lng: -97.82 });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/drops/:id/skip', () => {
    it('should mark drop as skipped', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'skipped', delivery_notes: 'No access' }],
      });

      const res = await request(app)
        .post('/api/drops/1/skip')
        .set('Authorization', `Bearer ${driverToken()}`)
        .send({ delivery_notes: 'No access' });

      expect(res.status).toBe(200);
      expect(res.body.drop.status).toBe('skipped');
    });
  });

  describe('GET /api/drops/history', () => {
    it('should return delivery history', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 5 }] });
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, property_id: 1, status: 'delivered', address: '123 Main St' },
        ],
      });

      const res = await request(app)
        .get('/api/drops/history')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.drops).toBeDefined();
      expect(res.body.total).toBeDefined();
    });
  });

  describe('GET /api/drops/stats', () => {
    it('should return delivery statistics', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 23 }] }); // daily
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 150 }] }); // weekly
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 500 }] }); // monthly
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 47 }] }); // queued
      mockQuery.mockResolvedValueOnce({ rows: [] }); // daily breakdown

      const res = await request(app)
        .get('/api/drops/stats')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.today).toBe(23);
      expect(res.body.this_week).toBe(150);
      expect(res.body.this_month).toBe(500);
      expect(res.body.queued).toBe(47);
    });
  });
});
