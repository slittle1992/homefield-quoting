const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { authenticate, generateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/drivers - list all drivers
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, phone, is_active FROM drivers ORDER BY name'
    );
    res.json({ drivers: result.rows });
  } catch (err) {
    console.error('List drivers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/drivers - create driver
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO drivers (name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, phone, is_active`,
      [name, email || null, phone || null, passwordHash]
    );

    res.status(201).json({ driver: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Driver with this email already exists' });
    }
    console.error('Create driver error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/drivers/:id - update driver
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, phone, password, is_active } = req.body;

    const fields = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      params.push(name);
    }

    if (email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      params.push(email);
    }

    if (phone !== undefined) {
      fields.push(`phone = $${paramIndex++}`);
      params.push(phone);
    }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      fields.push(`password_hash = $${paramIndex++}`);
      params.push(passwordHash);
    }

    if (is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE drivers SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, name, email, phone, is_active`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json({ driver: result.rows[0] });
  } catch (err) {
    console.error('Update driver error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/drivers/login - driver login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      'SELECT id, name, email, phone, password_hash, is_active FROM drivers WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const driver = result.rows[0];

    if (!driver.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const validPassword = await bcrypt.compare(password, driver.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken({
      id: driver.id,
      email: driver.email,
      name: driver.name,
      role: 'driver',
    });

    res.json({
      token,
      user: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        role: 'driver',
      },
    });
  } catch (err) {
    console.error('Driver login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
