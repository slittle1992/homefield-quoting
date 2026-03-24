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

const sampleProperty = {
  id: 1,
  address: '2804 Welton Cliff Dr',
  city: 'Cedar Park',
  state: 'TX',
  zip: '78613',
  latitude: 30.51,
  longitude: -97.82,
  owner_name: 'John Smith',
  property_value: 450000,
  year_built: 2015,
  subdivision: 'Twin Creeks',
  pool_type: 'gunite',
  lead_source: 'wcad',
  campaign_status: 'not_started',
  campaign_drops_completed: 0,
  campaign_total_drops: 4,
  do_not_drop: false,
  created_at: new Date(),
  updated_at: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Properties Routes', () => {
  describe('GET /api/properties', () => {
    it('should list properties with pagination', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] }); // count query
      mockQuery.mockResolvedValueOnce({ rows: [sampleProperty] }); // data query

      const res = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.properties).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.properties[0].address).toBe('2804 Welton Cliff Dr');
    });

    it('should filter by lead_source', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/properties?lead_source=mls')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      // Verify the first query (count) included the lead_source param
      expect(mockQuery.mock.calls[0][1]).toContain('mls');
    });

    it('should filter by search term', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] });
      mockQuery.mockResolvedValueOnce({ rows: [sampleProperty] });

      const res = await request(app)
        .get('/api/properties?search=Welton')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(mockQuery.mock.calls[0][1]).toContain('%Welton%');
    });

    it('should require auth', async () => {
      const res = await request(app).get('/api/properties');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/properties/:id', () => {
    it('should return property with drops, mailers, conversions', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [sampleProperty] }); // property
      mockQuery.mockResolvedValueOnce({ rows: [] }); // drops
      mockQuery.mockResolvedValueOnce({ rows: [] }); // mailers
      mockQuery.mockResolvedValueOnce({ rows: [] }); // conversions

      const res = await request(app)
        .get('/api/properties/1')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.property.address).toBe('2804 Welton Cliff Dr');
      expect(res.body.drops).toEqual([]);
      expect(res.body.mailers).toEqual([]);
      expect(res.body.conversions).toEqual([]);
    });

    it('should return 404 for missing property', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/properties/999')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/properties', () => {
    it('should create a property', async () => {
      const newProp = { ...sampleProperty, id: 2 };
      mockQuery.mockResolvedValueOnce({ rows: [newProp] }); // insert

      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          address: '123 Main St',
          city: 'Cedar Park',
          zip: '78613',
          latitude: 30.51,
          longitude: -97.82,
          lead_source: 'wcad',
        });

      expect(res.status).toBe(201);
      expect(res.body.property).toBeDefined();
    });

    it('should return 400 if address missing', async () => {
      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ city: 'Cedar Park' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/address/i);
    });

    it('should auto-start campaign for manual_spotted leads', async () => {
      const newProp = { ...sampleProperty, id: 3, lead_source: 'manual_spotted' };
      mockQuery.mockResolvedValueOnce({ rows: [newProp] }); // insert property
      mockQuery.mockResolvedValueOnce({ rows: [] }); // insert drop_queue

      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          address: '456 Pool Lane',
          city: 'Cedar Park',
          zip: '78613',
          lead_source: 'manual_spotted',
        });

      expect(res.status).toBe(201);
      // Verify drop_queue insert was called
      expect(mockQuery).toHaveBeenCalledTimes(2);
      const dropInsertCall = mockQuery.mock.calls[1];
      expect(dropInsertCall[0]).toMatch(/INSERT INTO drop_queue/);
    });

    it('should return 409 on duplicate address+zip', async () => {
      mockQuery.mockRejectedValueOnce({ code: '23505' });

      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          address: '2804 Welton Cliff Dr',
          zip: '78613',
        });

      expect(res.status).toBe(409);
    });
  });

  describe('PUT /api/properties/:id', () => {
    it('should update property fields', async () => {
      const updated = { ...sampleProperty, owner_name: 'Jane Doe' };
      mockQuery.mockResolvedValueOnce({ rows: [updated] });

      const res = await request(app)
        .put('/api/properties/1')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ owner_name: 'Jane Doe' });

      expect(res.status).toBe(200);
      expect(res.body.property.owner_name).toBe('Jane Doe');
    });

    it('should return 404 for non-existent property', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/properties/999')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ owner_name: 'Test' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/properties/:id', () => {
    it('should delete property and related records', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 1 }] }); // all deletes + property delete

      const res = await request(app)
        .delete('/api/properties/1')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
      // Should have deleted fb_export_properties, conversions, mailer_queue, drop_queue, then property
      expect(mockQuery).toHaveBeenCalledTimes(5);
    });

    it('should require admin role', async () => {
      const res = await request(app)
        .delete('/api/properties/1')
        .set('Authorization', `Bearer ${driverToken()}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/properties/:id/do-not-drop', () => {
    it('should toggle do_not_drop flag', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, do_not_drop: true }] });

      const res = await request(app)
        .post('/api/properties/1/do-not-drop')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.property.do_not_drop).toBe(true);
    });
  });

  describe('POST /api/properties/:id/convert', () => {
    it('should mark property as converted', async () => {
      const convertedProp = { ...sampleProperty, converted_at: new Date(), campaign_status: 'converted' };
      mockQuery.mockResolvedValueOnce({ rows: [convertedProp] }); // update property
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 5 }] }); // last drop
      mockQuery.mockResolvedValueOnce({ rows: [] }); // last mailer
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, property_id: 1, conversion_channel: 'flyer_2' }] }); // insert conversion

      const res = await request(app)
        .post('/api/properties/1/convert')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          conversion_channel: 'flyer_2',
          customer_name: 'John Smith',
          service_type: 'pool cleaning',
          revenue: 250.00,
        });

      expect(res.status).toBe(200);
      expect(res.body.property).toBeDefined();
      expect(res.body.conversion).toBeDefined();
    });

    it('should require conversion_channel', async () => {
      const res = await request(app)
        .post('/api/properties/1/convert')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ customer_name: 'John' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/properties/stats', () => {
    it('should return aggregated stats', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ campaign_status: 'not_started', count: 10 }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ lead_source: 'wcad', count: 8 }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ total: 10, do_not_drop: 1, converted: 2, fb_exported: 0 }] });

      const res = await request(app)
        .get('/api/properties/stats')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.by_status).toBeDefined();
      expect(res.body.by_source).toBeDefined();
      expect(res.body.totals).toBeDefined();
    });
  });

  describe('GET /api/properties/map', () => {
    it('should return properties within bounding box', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, latitude: 30.51, longitude: -97.82, campaign_status: 'not_started' }],
      });

      const res = await request(app)
        .get('/api/properties/map?sw_lat=30.0&sw_lng=-98.0&ne_lat=31.0&ne_lng=-97.0')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.properties).toHaveLength(1);
    });

    it('should return 400 without bounding box params', async () => {
      const res = await request(app)
        .get('/api/properties/map')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/properties/reverse-geocode', () => {
    it('should return 400 if lat/lng missing', async () => {
      const res = await request(app)
        .post('/api/properties/reverse-geocode')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ latitude: 30.51 });

      expect(res.status).toBe(400);
    });

    it('should return 500 if mapbox token not configured', async () => {
      const origToken = process.env.MAPBOX_ACCESS_TOKEN;
      delete process.env.MAPBOX_ACCESS_TOKEN;

      const res = await request(app)
        .post('/api/properties/reverse-geocode')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ latitude: 30.51, longitude: -97.82 });

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/mapbox/i);

      if (origToken) process.env.MAPBOX_ACCESS_TOKEN = origToken;
    });
  });
});
