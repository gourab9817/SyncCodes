# Single-image deployment for SyncCodes (frontend + backend in one container)

# 1) Build React frontend
FROM node:20-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
ARG REACT_APP_API_URL=/
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
RUN npm run build

# 2) Install backend deps + prisma client
FROM node:20-bookworm-slim AS backend-build
WORKDIR /app/backend
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY backend/ ./

# 3) Final runtime image
FROM node:20-bookworm-slim AS runtime
WORKDIR /app/backend
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Backend app
COPY --from=backend-build /app/backend /app/backend

# Frontend static build where backend expects it: ../client/build
COPY --from=client-build /app/client/build /app/client/build

ENV NODE_ENV=production
EXPOSE 8000

CMD ["node", "server.js"]
