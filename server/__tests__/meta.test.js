const { mockQuery } = require('./setup');
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Must require app AFTER mocks are set up
const app = require('../src/index');

// Helper to generate a valid admin token
function adminToken() {
  return jwt.sign(
    { id: 1, email: 'admin@pooldrop.com', name: 'Admin', role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Meta Routes', () => {
  describe('GET /api/meta/campaigns', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/meta/campaigns');
      expect(res.status).toBe(401);
    });

    it('should return empty campaigns array initially', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .get('/api/meta/campaigns')
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.campaigns).toEqual([]);
    });
  });

  describe('GET /api/meta/campaigns/:id', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/meta/campaigns/1');
      expect(res.status).toBe(401);
    });

    it('should return 404 when campaign does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .get('/api/meta/campaigns/999')
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  describe('POST /api/meta/launch', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/meta/launch')
        .send({ campaign_status: 'not_started' });
      expect(res.status).toBe(401);
    });

    it('should return 500 when Meta credentials are not configured', async () => {
      // The launch route queries properties first, then calls Meta API
      // Properties query returns some data
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, owner_name: 'Smith, John', address: '123 Main St', city: 'Austin', state: 'TX', zip: '78701', latitude: 30.27, longitude: -97.74 }],
      });

      // META_ACCESS_TOKEN is not set, so metaService.createCustomAudience will throw
      const res = await request(app)
        .post('/api/meta/launch')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ campaign_status: 'not_started' });

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/failed/i);
    });

    it('should return 404 when no properties match filters', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .post('/api/meta/launch')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ campaign_status: 'not_started', subdivision: 'Nonexistent' });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/no properties/i);
    });
  });

  describe('POST /api/meta/campaigns/:id/activate', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).post('/api/meta/campaigns/1/activate');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/meta/campaigns/:id/pause', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).post('/api/meta/campaigns/1/pause');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/meta/templates', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/meta/templates');
      expect(res.status).toBe(401);
    });

    it('should return ad templates when authenticated', async () => {
      const res = await request(app)
        .get('/api/meta/templates')
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.templates).toHaveLength(3);
      expect(res.body.templates[0]).toHaveProperty('name');
      expect(res.body.templates[0]).toHaveProperty('headline');
    });
  });
});
