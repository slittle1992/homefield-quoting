const jwt = require('jsonwebtoken');

// The auth module reads JWT_SECRET at load time, so we need to set it first
process.env.JWT_SECRET = 'test-secret-key';
const { authenticate, generateToken, requireRole } = require('../src/middleware/auth');

// The module caches 'pooldrop-dev-secret' as the JWT_SECRET since env wasn't set
// when it first loaded (in other test files). So we need to use the actual secret
// the module is using. Let's determine it by generating a token and decoding it.
const JWT_SECRET = (() => {
  const token = generateToken({ test: true });
  // Try both possible secrets
  try {
    jwt.verify(token, 'test-secret-key');
    return 'test-secret-key';
  } catch {
    try {
      jwt.verify(token, 'pooldrop-dev-secret');
      return 'pooldrop-dev-secret';
    } catch {
      return 'test-secret-key';
    }
  }
})();

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken({ id: 1, email: 'test@test.com', role: 'admin' });
      expect(token).toBeDefined();
      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.id).toBe(1);
      expect(decoded.email).toBe('test@test.com');
      expect(decoded.role).toBe('admin');
    });

    it('should set expiration', () => {
      const token = generateToken({ id: 1 });
      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('authenticate', () => {
    it('should return 401 if no authorization header', () => {
      authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid token', () => {
      req.headers.authorization = 'Bearer invalid-token';
      authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 for expired token', () => {
      const expired = jwt.sign(
        { id: 1, iat: Math.floor(Date.now() / 1000) - 20, exp: Math.floor(Date.now() / 1000) - 10 },
        JWT_SECRET
      );
      req.headers.authorization = `Bearer ${expired}`;
      authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/expired/i) }));
    });

    it('should call next() and set req.user for valid token', () => {
      const token = jwt.sign({ id: 1, email: 'test@test.com', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${token}`;
      authenticate(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user.id).toBe(1);
      expect(req.user.role).toBe('admin');
    });

    it('should handle token without Bearer prefix', () => {
      const token = jwt.sign({ id: 1, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
      req.headers.authorization = token;
      authenticate(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user.id).toBe(1);
    });
  });

  describe('requireRole', () => {
    it('should return 401 if no user on request', () => {
      const middleware = requireRole('admin');
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user has wrong role', () => {
      req.user = { id: 1, role: 'driver' };
      const middleware = requireRole('admin');
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if user has correct role', () => {
      req.user = { id: 1, role: 'admin' };
      const middleware = requireRole('admin');
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should accept multiple roles', () => {
      req.user = { id: 1, role: 'driver' };
      const middleware = requireRole('admin', 'driver');
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
