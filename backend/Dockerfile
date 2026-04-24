# ── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:20-bookworm-slim AS deps

WORKDIR /app

# Install tini (PID-1 signal forwarder) and system deps for Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
      tini \
      openssl \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests first so this layer is cached unless deps change
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: generate Prisma client ──────────────────────────────────────────
FROM deps AS builder

COPY prisma ./prisma
RUN npx prisma generate

# ── Stage 3: production image ─────────────────────────────────────────────────
FROM node:20-bookworm-slim AS production

WORKDIR /app

# Install runtime-only system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
      tini \
      openssl \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1001 nodejs \
    && useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home appuser

# Copy installed node_modules and generated Prisma client from earlier stages
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules

# Copy application source (everything not in .dockerignore)
COPY --chown=appuser:nodejs . .

# Switch to non-root user before running anything
USER appuser

ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

# tini as PID 1: properly forwards SIGTERM to node so graceful shutdown works.
# Without tini, Docker sends SIGTERM to PID 1 (node), which ignores it by default,
# and the container is force-killed after the stop timeout.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]

HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:8000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
