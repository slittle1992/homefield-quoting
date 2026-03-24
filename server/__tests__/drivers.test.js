const { mockQuery } = require('./setup');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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

describe('Drivers Routes', () => {
  describe('GET /api/drivers', () => {
    it('should list all drivers', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Driver One', email: 'driver1@test.com', phone: '555-0001', is_active: true },
          { id: 2, name: 'Driver Two', email: 'driver2@test.com', phone: '555-0002', is_active: true },
        ],
      });

      const res = await request(app)
        .get('/api/drivers')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.drivers).toHaveLength(2);
    });
  });

  describe('POST /api/drivers', () => {
    it('should create a new driver', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 3, name: 'New Driver', email: 'new@test.com', phone: '555-0003', is_active: true }],
      });

      const res = await request(app)
        .post('/api/drivers')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'New Driver', email: 'new@test.com', phone: '555-0003', password: 'driver123' });

      expect(res.status).toBe(201);
      expect(res.body.driver.name).toBe('New Driver');
    });

    it('should return 400 if name missing', async () => {
      const res = await request(app)
        .post('/api/drivers')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ email: 'test@test.com', password: 'pass' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if password missing', async () => {
      const res = await request(app)
        .post('/api/drivers')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Test Driver' });

      expect(res.status).toBe(400);
    });

    it('should return 409 on duplicate email', async () => {
      mockQuery.mockRejectedValueOnce({ code: '23505' });

      const res = await request(app)
        .post('/api/drivers')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Dup Driver', email: 'dup@test.com', password: 'pass123' });

      expect(res.status).toBe(409);
    });
  });

  describe('PUT /api/drivers/:id', () => {
    it('should update driver fields', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Updated Driver', email: 'updated@test.com', phone: '555-9999', is_active: true }],
      });

      const res = await request(app)
        .put('/api/drivers/1')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Updated Driver', phone: '555-9999' });

      expect(res.status).toBe(200);
      expect(res.body.driver.name).toBe('Updated Driver');
    });

    it('should return 400 if no fields provided', async () => {
      const res = await request(app)
        .put('/api/drivers/1')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent driver', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/drivers/999')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/drivers/login', () => {
    it('should authenticate driver and return token', async () => {
      const hash = await bcrypt.hash('driver123', 10);
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Driver One', email: 'driver@test.com', phone: '555-0001', password_hash: hash, is_active: true }],
      });

      const res = await request(app)
        .post('/api/drivers/login')
        .send({ email: 'driver@test.com', password: 'driver123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('driver');

      const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
      expect(decoded.role).toBe('driver');
    });

    it('should return 401 for wrong password', async () => {
      const hash = await bcrypt.hash('correct', 10);
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Driver', email: 'driver@test.com', password_hash: hash, is_active: true }],
      });

      const res = await request(app)
        .post('/api/drivers/login')
        .send({ email: 'driver@test.com', password: 'wrong' });

      expect(res.status).toBe(401);
    });

    it('should return 403 for deactivated driver', async () => {
      const hash = await bcrypt.hash('pass', 10);
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Driver', email: 'driver@test.com', password_hash: hash, is_active: false }],
      });

      const res = await request(app)
        .post('/api/drivers/login')
        .send({ email: 'driver@test.com', password: 'pass' });

      expect(res.status).toBe(403);
    });

    it('should return 400 if email or password missing', async () => {
      const res = await request(app)
        .post('/api/drivers/login')
        .send({ email: 'driver@test.com' });

      expect(res.status).toBe(400);
    });
  });
});
