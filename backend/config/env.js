require('dotenv').config();
const fs = require('fs');
const path = require('path');

const required = ['DATABASE_URL', 'JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const isProd = process.env.NODE_ENV === 'production';

const bool = (v, fallback = false) => {
  if (v === undefined || v === '') return fallback;
  return String(v).toLowerCase() === 'true' || v === '1';
};

const executionBackend = (process.env.EXECUTION_BACKEND || 'local').toLowerCase();

// Hard block: local executor must never run in production — it executes
// untrusted user code on the API host with full access to env vars and disk.
if (isProd && executionBackend === 'local') {
  throw new Error(
    'EXECUTION_BACKEND=local is not allowed in production. ' +
    'Set EXECUTION_BACKEND=piston and configure PISTON_API_URL, ' +
    'or set EXECUTION_BACKEND=disabled to turn off code execution.'
  );
}

const backendRoot = path.join(__dirname, '..');
const monorepoClientIndex = path.join(backendRoot, '..', 'client', 'build', 'index.html');

/** Host React build from this server when the build exists (or force with SERVE_CLIENT_STATIC). */
const serveClientStatic =
  process.env.SERVE_CLIENT_STATIC !== undefined && String(process.env.SERVE_CLIENT_STATIC).trim() !== ''
    ? bool(process.env.SERVE_CLIENT_STATIC)
    : fs.existsSync(monorepoClientIndex);

/** Extra browser origins for CORS/Socket.IO (comma-separated), e.g. preview URL + production. */
const extraAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

module.exports = {
  port: parseInt(process.env.PORT) || 8000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  serveClientStatic,
  extraAllowedOrigins,

  /** When true, Socket.IO rejects connections without a verified JWT */
  socketAuthRequired:
    process.env.SOCKET_AUTH_REQUIRED !== undefined
      ? bool(process.env.SOCKET_AUTH_REQUIRED)
      : isProd,

  redisUrl: process.env.REDIS_URL || '',

  /** Supabase project URL (https://<ref>.supabase.co) — used for JWT issuer + client config */
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET || '',

  /** Legacy Neon / Stack Auth JWKS (optional if fully on Supabase) */
  neonJwks: process.env.NEON_JWKS,
  stackSecretKey: process.env.STACK_SECRET_SERVER_KEY,

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
  },

  /**
   * Code execution (see backend/services/codeExecution/)
   * - local:    run compilers on the API host (dev only — BLOCKED in production)
   * - piston:   self-hosted Piston service (recommended for production)
   * - disabled: return a clear error to the client, no execution
   */
  execution: {
    backend: executionBackend,
    pistonUrl: (process.env.PISTON_API_URL || '').replace(/\/$/, ''),
    // requireAuth defaults to true always; set EXECUTION_REQUIRE_AUTH=false only for local dev
    requireAuth:
      process.env.EXECUTION_REQUIRE_AUTH !== undefined
        ? bool(process.env.EXECUTION_REQUIRE_AUTH)
        : true,
    maxSourceChars: parseInt(process.env.EXECUTION_MAX_SOURCE_CHARS || '100000', 10),
  },
};
