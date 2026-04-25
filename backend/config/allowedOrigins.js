const env = require('./env');

/**
 * CORS / Socket.IO origin check. In development, allow any localhost/127.0.0.1
 * port so CRA (3000), Vite (5173), or alternate dev ports are not blocked — a
 * common RCA for "same room code, two isolated clients" was strict allowlist
 * (3000 only) when one tab used a different port or 127.0.0.1 vs localhost.
 */
function isOriginAllowed(origin) {
  if (!origin) return true;
  if (origin === env.clientUrl) return true;
  if (env.nodeEnv !== 'production') {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      return true;
    }
  }
  return false;
}

module.exports = { isOriginAllowed };
