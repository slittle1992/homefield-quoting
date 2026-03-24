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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Export Routes', () => {
  describe('POST /api/export/facebook', () => {
    it('should generate Facebook Custom Audience CSV', async () => {
      // Query matching properties
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, owner_name: 'SMITH, JOHN', address: '2804 Welton Cliff Dr', city: 'Cedar Park', state: 'TX', zip: '78613' },
          { id: 2, owner_name: 'DOE JANE', address: '456 Oak Ave', city: 'Cedar Park', state: 'TX', zip: '78613' },
        ],
      });
      // Log export
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // fb_export_log INSERT
      // Log individual properties (2 inserts)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Update fb_exported_at
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/export/facebook')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          campaign_status: ['flyer_complete', 'mailer_complete'],
          exclude_already_exported: true,
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/fb_audience_/);

      // Parse CSV
      const lines = res.text.split('\n');
      expect(lines[0]).toBe('fn,ln,st,ct,zip,country');
      // "SMITH, JOHN" should be parsed as firstName=John, lastName=Smith
      expect(lines[1]).toBe('John,Smith,2804 Welton Cliff Dr,Cedar Park,78613,US');
      // "DOE JANE" should be parsed as firstName=Doe, lastName=Jane
      expect(lines[2]).toBe('Doe,Jane,456 Oak Ave,Cedar Park,78613,US');
    });

    it('should filter by campaign_status array', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, owner_name: 'TEST', address: '100 Test St', city: 'Austin', state: 'TX', zip: '78613' }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/export/facebook')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ campaign_status: ['flyer_complete'] });

      expect(res.status).toBe(200);
      // Verify the query included the status filter
      const queryStr = mockQuery.mock.calls[0][0];
      expect(queryStr).toMatch(/campaign_status IN/);
    });

    it('should return 404 when no properties match', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/export/facebook')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ campaign_status: 'nonexistent' });

      expect(res.status).toBe(404);
    });

    it('should exclude already exported when flag set', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // no results after excluding

      const res = await request(app)
        .post('/api/export/facebook')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ exclude_already_exported: true });

      // Verify query includes fb_exported_at IS NULL
      const queryStr = mockQuery.mock.calls[0][0];
      expect(queryStr).toMatch(/fb_exported_at IS NULL/);
    });

    it('should require admin role', async () => {
      const driverTkn = jwt.sign(
        { id: 10, role: 'driver', email: 'driver@test.com' },
        process.env.JWT_SECRET
      );
      const res = await request(app)
        .post('/api/export/facebook')
        .set('Authorization', `Bearer ${driverTkn}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/export/converted', () => {
    it('should export converted customers CSV', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            owner_name: 'JONES, BOB',
            customer_name: 'Bob Jones',
            address: '789 Elm St',
            city: 'Cedar Park',
            state: 'TX',
            zip: '78613',
            service_type: 'pool cleaning',
            revenue: 250.00,
            conversion_channel: 'flyer_2',
            converted_at: new Date(),
          },
        ],
      });

      const res = await request(app)
        .post('/api/export/converted')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/converted_lookalike_/);

      const lines = res.text.split('\n');
      expect(lines[0]).toBe('fn,ln,st,ct,zip,country');
      // customer_name "Bob Jones" → fn=Bob, ln=Jones
      expect(lines[1]).toBe('Bob,Jones,789 Elm St,Cedar Park,78613,US');
    });

    it('should return 404 when no conversions', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/export/converted')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(404);
    });
  });
});
