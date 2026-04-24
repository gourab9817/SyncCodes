const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { z } = require('zod');

const COOKIE_NAME = 'sc_refresh';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/api/auth',
};

const registerSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function signRefreshToken(user) {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  return jwt.sign(
    { sub: user.id, type: 'refresh' },
    secret,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

function setRefreshCookie(res, token) {
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
}

function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTS, maxAge: 0 });
}

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = registerSchema.parse(req.body);

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, name, password: hashedPassword, emailVerified: false },
      select: { id: true, email: true, name: true, avatar: true, createdAt: true },
    });

    const access_token = signAccessToken(user);
    setRefreshCookie(res, signRefreshToken(user));

    res.status(201).json({ access_token, user });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    next(err);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userPayload = {
      id: user.id, email: user.email, name: user.name,
      avatar: user.avatar, createdAt: user.createdAt,
    };

    const access_token = signAccessToken(user);
    setRefreshCookie(res, signRefreshToken(user));

    res.json({ access_token, user: userPayload });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    next(err);
  }
});

// Refresh — silently issue a new access token using the httpOnly refresh cookie.
// Frontend calls this automatically when it gets a 401.
router.post('/refresh', async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);

    if (decoded.type !== 'refresh') {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, name: true, avatar: true, createdAt: true },
    });

    if (!user) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Account not found' });
    }

    // Rotate the refresh token on each use
    const access_token = signAccessToken(user);
    setRefreshCookie(res, signRefreshToken(user));

    res.json({ access_token, user });
  } catch {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Refresh token expired or invalid' });
  }
});

// Logout — clears the refresh cookie server-side
router.post('/logout', (req, res) => {
  clearRefreshCookie(res);
  res.json({ ok: true });
});

module.exports = router;
