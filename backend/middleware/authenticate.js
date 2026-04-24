const jwt = require('jsonwebtoken');
const jwks = require('jwks-rsa');
const prisma = require('../config/db');
const { syncUser } = require('../services/userSyncService');

const neonJwksClient = process.env.NEON_JWKS ? jwks({
  jwksUri: process.env.NEON_JWKS,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000,
}) : null;

const verifyRS256 = (token) =>
  new Promise((resolve, reject) => {
    if (!neonJwksClient) return reject(new Error('JWKS not configured'));
    jwt.verify(
      token,
      (header, cb) => {
        neonJwksClient.getSigningKey(header.kid, (err, key) => cb(err, key?.getPublicKey()));
      },
      { algorithms: ['RS256'] },
      (err, decoded) => (err ? reject(err) : resolve(decoded))
    );
  });

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.slice(7);

  // Try local HS256 JWT first (password auth)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, name: true, avatar: true },
    });
    if (user) {
      req.user = user;
      return next();
    }
    // Valid token but user no longer exists in DB
    return res.status(401).json({ error: 'Account not found' });
  } catch {
    // Token is not a local JWT — try Neon OAuth RS256
  }

  if (neonJwksClient) {
    try {
      const decoded = await verifyRS256(token);
      req.user = await syncUser(decoded);
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  return res.status(401).json({ error: 'Invalid or expired token' });
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  const token = authHeader.slice(7);

  // Try local HS256 first
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, name: true, avatar: true },
    });
    if (user) req.user = user;
    return next();
  } catch {
    // Not a local JWT
  }

  // Try Neon Auth RS256 — must fully await before calling next()
  if (neonJwksClient) {
    try {
      const decoded = await verifyRS256(token);
      try { req.user = await syncUser(decoded); } catch {}
    } catch {}
  }

  return next();
};

module.exports = { authenticate, optionalAuth };
