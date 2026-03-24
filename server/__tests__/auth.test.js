const { mockQuery } = require('./setup');
const request = require('supertest');
const bcrypt = require('bcryptjs');
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

describe('Auth Routes', () => {
  describe('POST /api/auth/login', () => {
    it('should return 400 if email or password missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });

    it('should return 401 if user not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nope@test.com', password: 'pass' });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid/i);
    });

    it('should return 401 if password is wrong', async () => {
      const hash = await bcrypt.hash('correctpassword', 10);
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Admin', email: 'admin@test.com', password_hash: hash, role: 'admin' }],
      });
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'wrongpassword' });
      expect(res.status).toBe(401);
    });

    it('should return token on successful login', async () => {
      const hash = await bcrypt.hash('admin123', 10);
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Admin', email: 'admin@test.com', password_hash: hash, role: 'admin' }],
      });
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'admin123' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('admin@test.com');
      expect(res.body.user.role).toBe('admin');
      // Verify token is valid
      const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
      expect(decoded.id).toBe(1);
    });
  });

  describe('POST /api/auth/register', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'New User', email: 'new@test.com', password: 'pass123' });
      expect(res.status).toBe(401);
    });

    it('should return 400 if required fields missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'New User' });
      expect(res.status).toBe(400);
    });

    it('should return 409 if email already exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 2 }] }); // existing user check
      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'New User', email: 'existing@test.com', password: 'pass123' });
      expect(res.status).toBe(409);
    });

    it('should create user successfully', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // no existing user
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 2, name: 'New User', email: 'new@test.com', role: 'admin', created_at: new Date() }],
      });
      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'New User', email: 'new@test.com', password: 'pass123' });
      expect(res.status).toBe(201);
      expect(res.body.user.name).toBe('New User');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user info', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin', created_at: new Date() }],
      });
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('admin@test.com');
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return 401 with expired token', async () => {
      const expiredToken = jwt.sign(
        { id: 1, email: 'admin@test.com', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '0s' }
      );
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/expired/i);
    });
  });
});

describe('Health Check', () => {
  it('should return ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});
