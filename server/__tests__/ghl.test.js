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

describe('GHL Routes', () => {
  describe('GET /api/ghl/status', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/ghl/status');
      expect(res.status).toBe(401);
    });

    it('should return not connected when no integration rows exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .get('/api/ghl/status')
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(false);
      expect(res.body.has_api_key).toBe(false);
      expect(res.body.has_location_id).toBe(false);
    });

    it('should return connected when both keys exist', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { key: 'ghl_api_key', value: 'test-key-123' },
          { key: 'ghl_location_id', value: 'loc-456' },
        ],
      });
      const res = await request(app)
        .get('/api/ghl/status')
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
      expect(res.body.has_api_key).toBe(true);
      expect(res.body.has_location_id).toBe(true);
    });

    it('should return not connected when only api_key exists', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'ghl_api_key', value: 'test-key-123' }],
      });
      const res = await request(app)
        .get('/api/ghl/status')
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(false);
      expect(res.body.has_api_key).toBe(true);
      expect(res.body.has_location_id).toBe(false);
    });
  });

  describe('POST /api/ghl/connect', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/ghl/connect')
        .send({ api_key: 'key', location_id: 'loc' });
      expect(res.status).toBe(401);
    });

    it('should return 400 if api_key is missing', async () => {
      const res = await request(app)
        .post('/api/ghl/connect')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ location_id: 'loc-123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });

    it('should return 400 if location_id is missing', async () => {
      const res = await request(app)
        .post('/api/ghl/connect')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ api_key: 'key-123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });

    it('should save integration and return success', async () => {
      // Two upsert queries (api_key + location_id)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/ghl/connect')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ api_key: 'test-api-key', location_id: 'test-loc-id' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/connected/i);
      // Verify both upsert queries were called
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery.mock.calls[0][1]).toEqual(['test-api-key']);
      expect(mockQuery.mock.calls[1][1]).toEqual(['test-loc-id']);
    });
  });

  describe('DELETE /api/ghl/disconnect', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).delete('/api/ghl/disconnect');
      expect(res.status).toBe(401);
    });

    it('should remove integration and return success', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 2 });

      const res = await request(app)
        .delete('/api/ghl/disconnect')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/disconnected/i);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      // Verify the DELETE query targets the right keys
      expect(mockQuery.mock.calls[0][0]).toContain('ghl_api_key');
      expect(mockQuery.mock.calls[0][0]).toContain('ghl_location_id');
      expect(mockQuery.mock.calls[0][0]).toContain('ghl_workflow_id');
    });
  });

  describe('POST /api/ghl/test', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).post('/api/ghl/test');
      expect(res.status).toBe(401);
    });
  });
});
