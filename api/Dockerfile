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

# Only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output and migrations
COPY --from=builder /app/dist ./dist
COPY migrations ./migrations

EXPOSE 3000

# street start loads dist/main.js via the streetjs runtime
CMD ["node", "dist/main.js"]
