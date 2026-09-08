# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Install stunnel for TLS termination (required for Neon / SSL-only PostgreSQL)
RUN apk add --no-cache stunnel

# Only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output, migrations, and startup script
COPY --from=builder /app/dist ./dist
COPY migrations ./migrations
COPY start.sh ./start.sh
RUN chmod +x start.sh

EXPOSE 3000

CMD ["./start.sh"]
