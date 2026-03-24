const { mockQuery } = require('./setup');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const path = require('path');

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

describe('Import Routes', () => {
  describe('POST /api/import/wcad', () => {
    it('should import WCAD CSV and filter for pool properties', async () => {
      const csvContent = [
        'prop_id,owner_name,situs_address,situs_city,situs_zip,legal_desc,market_value,year_built,impr_desc',
        '1001,SMITH JOHN,123 Main St,Cedar Park,78613,TWIN CREEKS BLK A LOT 1,450000,2015,GUNITE POOL',
        '1002,DOE JANE,456 Oak Ave,Cedar Park,78613,AVERY RANCH BLK B LOT 5,380000,2018,VINYL POOL',
        '1003,JONES BOB,789 Elm St,Cedar Park,78613,RANCH BRUSHY CREEK LOT 10,520000,2010,PATIO COVER',
      ].join('\n');

      // Mock upsert for the 2 pool properties
      mockQuery.mockResolvedValueOnce({ rows: [{ is_new: true }] }); // GUNITE POOL
      mockQuery.mockResolvedValueOnce({ rows: [{ is_new: true }] }); // VINYL POOL

      const res = await request(app)
        .post('/api/import/wcad')
        .set('Authorization', `Bearer ${adminToken()}`)
        .attach('file', Buffer.from(csvContent), 'wcad_export.csv');

      expect(res.status).toBe(200);
      expect(res.body.total_rows).toBe(3);
      expect(res.body.pool_properties_found).toBe(2);
      expect(res.body.new_imported).toBe(2);
      expect(res.body.already_existed).toBe(0);
    });

    it('should detect already existing properties', async () => {
      const csvContent = [
        'prop_id,owner_name,situs_address,situs_city,situs_zip,impr_desc',
        '1001,SMITH JOHN,123 Main St,Cedar Park,78613,POOL',
      ].join('\n');

      mockQuery.mockResolvedValueOnce({ rows: [{ is_new: false }] }); // already exists

      const res = await request(app)
        .post('/api/import/wcad')
        .set('Authorization', `Bearer ${adminToken()}`)
        .attach('file', Buffer.from(csvContent), 'wcad.csv');

      expect(res.status).toBe(200);
      expect(res.body.pool_properties_found).toBe(1);
      expect(res.body.new_imported).toBe(0);
      expect(res.body.already_existed).toBe(1);
    });

    it('should handle various pool keywords', async () => {
      const csvContent = [
        'address,impr_desc',
        '100 Pool Ln,ABOVE GROUND POOL',
        '200 Swim Dr,IN GROUND GUNITE POOL W/SPA',
        '300 Dive Ave,VINYL LINED POOL',
        '400 Fence Rd,WOOD FENCE',
      ].join('\n');

      mockQuery.mockResolvedValueOnce({ rows: [{ is_new: true }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ is_new: true }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ is_new: true }] });

      const res = await request(app)
        .post('/api/import/wcad')
        .set('Authorization', `Bearer ${adminToken()}`)
        .attach('file', Buffer.from(csvContent), 'wcad.csv');

      expect(res.status).toBe(200);
      expect(res.body.pool_properties_found).toBe(3);
      expect(res.body.new_imported).toBe(3);
    });

    it('should return 400 without file', async () => {
      const res = await request(app)
        .post('/api/import/wcad')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(400);
    });

    it('should return 400 for CSV with only headers', async () => {
      const csvContent = 'address,city,zip,impr_desc';

      const res = await request(app)
        .post('/api/import/wcad')
        .set('Authorization', `Bearer ${adminToken()}`)
        .attach('file', Buffer.from(csvContent), 'empty.csv');

      expect(res.status).toBe(400);
    });

    it('should return 400 if no address column found', async () => {
      const csvContent = [
        'col1,col2,col3',
        'val1,val2,POOL',
      ].join('\n');

      const res = await request(app)
        .post('/api/import/wcad')
        .set('Authorization', `Bearer ${adminToken()}`)
        .attach('file', Buffer.from(csvContent), 'bad.csv');

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/address column/i);
    });

    it('should require admin role', async () => {
      const res = await request(app)
        .post('/api/import/wcad')
        .set('Authorization', `Bearer ${driverToken()}`);

      expect(res.status).toBe(403);
    });

    it('should handle rows with missing address gracefully', async () => {
      const csvContent = [
        'address,impr_desc',
        ',GUNITE POOL',
        '200 Valid St,POOL',
      ].join('\n');

      mockQuery.mockResolvedValueOnce({ rows: [{ is_new: true }] });

      const res = await request(app)
        .post('/api/import/wcad')
        .set('Authorization', `Bearer ${adminToken()}`)
        .attach('file', Buffer.from(csvContent), 'wcad.csv');

      expect(res.status).toBe(200);
      expect(res.body.new_imported).toBe(1);
      expect(res.body.errors).not.toBeNull();
    });

    it('should extract pool type correctly', async () => {
      const csvContent = [
        'address,impr_desc',
        '100 A St,GUNITE POOL WITH SPA',
      ].join('\n');

      mockQuery.mockResolvedValueOnce({ rows: [{ is_new: true }] });

      const res = await request(app)
        .post('/api/import/wcad')
        .set('Authorization', `Bearer ${adminToken()}`)
        .attach('file', Buffer.from(csvContent), 'wcad.csv');

      expect(res.status).toBe(200);
      // Check that 'gunite' was passed to the query
      const insertCall = mockQuery.mock.calls[0];
      expect(insertCall[1]).toContain('gunite');
    });

    it('should extract subdivision from legal description', async () => {
      const csvContent = [
        'address,legal_desc,impr_desc',
        '100 A St,TWIN CREEKS BLK A LOT 5,POOL',
      ].join('\n');

      mockQuery.mockResolvedValueOnce({ rows: [{ is_new: true }] });

      const res = await request(app)
        .post('/api/import/wcad')
        .set('Authorization', `Bearer ${adminToken()}`)
        .attach('file', Buffer.from(csvContent), 'wcad.csv');

      expect(res.status).toBe(200);
      const insertCall = mockQuery.mock.calls[0];
      expect(insertCall[1]).toContain('TWIN CREEKS');
    });
  });
});
