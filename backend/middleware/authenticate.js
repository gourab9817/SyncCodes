const jwt = require('jsonwebtoken');
const jwks = require('jwks-rsa');
const prisma = require('../config/db');
const logger = require('../utils/logger');
const { syncUser, syncSupabaseUser } = require('../services/userSyncService');
const { verifySupabaseAccessToken } = require('../lib/supabaseJwt');

const neonJwksClient = process.env.NEON_JWKS
  ? jwks({ jwksUri: process.env.NEON_JWKS, cache: true, cacheMaxEntries: 5, cacheMaxAge: 600000 })
  : null;

const verifyRS256 = (token) =>
  new Promise((resolve, reject) => {
    if (!neonJwksClient) return reject(new Error('JWKS not configured'));
    jwt.verify(
      token,
      (header, cb) => neonJwksClient.getSigningKey(header.kid, (err, key) => cb(err, key?.getPublicKey())),
      { algorithms: ['RS256'] },
      (err, decoded) => (err ? reject(err) : resolve(decoded))
    );
  });

/** Truncate token for safe log output (never log full JWTs). */
const tok = (t) => (t ? `${t.slice(0, 12)}…` : 'none');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.slice(7);
  logger.debug(`[auth] incoming token ${tok(token)} path=${req.path}`);

  // ── 1) App-issued HS256 (email/password login) ────────────────────────────
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, name: true, avatar: true },
    });
    if (user) {
      logger.debug(`[auth] app-JWT ok user=${user.id}`);
      req.user = user;
      return next();
    }
    logger.warn(`[auth] app-JWT valid but user ${decoded.sub} not in DB`);
    return res.status(401).json({ error: 'Account not found' });
  } catch (e) {
    logger.debug(`[auth] not app-JWT: ${e.message}`);
  }

  // ── 2) Supabase Auth token ────────────────────────────────────────────────
  if (process.env.SUPABASE_URL) {
    try {
      const decoded = await verifySupabaseAccessToken(token);
      logger.debug(`[auth] supabase token ok sub=${decoded.sub} email=${decoded.email}`);
      req.user = await syncSupabaseUser(decoded);
      logger.debug(`[auth] supabase user synced id=${req.user.id}`);
      return next();
    } catch (e) {
      logger.warn(`[auth] supabase verify/sync failed: ${e.message}`);
    }
  } else {
    logger.debug('[auth] SUPABASE_URL not set — skipping supabase path');
  }

  // ── 3) Legacy Neon OAuth RS256 ────────────────────────────────────────────
  if (neonJwksClient) {
    try {
      const decoded = await verifyRS256(token);
      req.user = await syncUser(decoded);
      return next();
    } catch (e) {
      logger.warn(`[auth] neon RS256 failed: ${e.message}`);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  logger.warn(`[auth] all strategies exhausted for token ${tok(token)}`);
  return res.status(401).json({ error: 'Invalid or expired token' });
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, name: true, avatar: true },
    });
    if (user) { req.user = user; return next(); }
  } catch { /* not app JWT */ }

  if (process.env.SUPABASE_URL) {
    try {
      const decoded = await verifySupabaseAccessToken(token);
      try { req.user = await syncSupabaseUser(decoded); } catch (e) {
        logger.warn(`[optionalAuth] supabase sync failed: ${e.message}`);
      }
      return next();
    } catch { /* fall through */ }
  }

  if (neonJwksClient) {
    try {
      const decoded = await verifyRS256(token);
      try { req.user = await syncUser(decoded); } catch { /* noop */ }
    } catch { /* noop */ }
  }

  return next();
};

module.exports = { authenticate, optionalAuth };
