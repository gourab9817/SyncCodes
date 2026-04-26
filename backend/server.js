const fs = require('fs');
const env = require('./config/env');
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const initSocket = require('./socket');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const roomRoutes = require('./routes/rooms');
const questionRoutes = require('./routes/questions');
const executeRoutes = require('./routes/execute');
const { isOriginAllowed } = require('./config/allowedOrigins');

const app = express();
const server = http.createServer(app);

// Required for express-rate-limit to key on real client IP when behind Nginx/proxy.
// Without this, all requests share the proxy's IP as the rate-limit bucket.
app.set('trust proxy', 1);

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    uptime: process.uptime(),
    env: env.nodeEnv,
    ts: new Date().toISOString(),
  });
});

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
    credentials: true,
  })
);
// Do not rate-limit Engine.IO long-poll; it can look like a burst of API calls.
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use((req, res, next) => {
  if (req.path && String(req.path).startsWith('/socket.io')) return next();
  return apiLimiter(req, res, next);
});

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/generate-questions', questionRoutes); // legacy alias
app.use('/api/execute', executeRoutes);

// Static React build (optional — API-only Docker images skip this when no build is present)
const clientBuildDir = path.join(__dirname, '../client/build');
const clientIndex = path.join(clientBuildDir, 'index.html');
const hasSpa = env.serveClientStatic && fs.existsSync(clientIndex);
if (hasSpa) {
  app.use(express.static(clientBuildDir));
}
// Do not use app.get('*') — it matches /socket.io and can break Engine.IO long-polling.
app.get(/^\/(?!socket\.io).*/, (req, res, next) => {
  if (hasSpa) {
    return res.sendFile(clientIndex, (err) => (err ? next(err) : undefined));
  }
  res.status(404).json({ error: 'not_found', message: 'No static app or handler for this path' });
});

app.use(errorHandler);

const prisma = require('./config/db');

initSocket(server)
  .then(() => {
    server.listen(env.port, () => {
      logger.info(`Server running on port ${env.port} (${env.nodeEnv})`);
    });
  })
  .catch((err) => {
    logger.error(`Failed to start Socket.IO: ${err.message}`);
    process.exit(1);
  });

// Graceful shutdown — allows in-flight requests to finish and closes the DB
// connection pool cleanly. Container orchestrators (Docker, k8s) send SIGTERM.
const shutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
    } catch {}
    logger.info('Server closed');
    process.exit(0);
  });
  // Force-exit if connections don't drain within 15 s
  setTimeout(() => {
    logger.error('Forced exit after 15 s timeout');
    process.exit(1);
  }, 15000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
