import type { StreetAppOptions } from 'streetjs';

export default {
  port:             parseInt(process.env['PORT'] ?? '3000', 10),
  host:             process.env['HOST'] ?? '0.0.0.0',
  jwtSecret:        process.env['JWT_SECRET'] ?? 'change-me-in-production-256bit',
  sessionKey:       process.env['SESSION_KEY'] ?? 'change-me-session-key',
  nodeEnv:          process.env['NODE_ENV'] ?? 'development',
  uploadsDir:       process.env['UPLOADS_DIR'] ?? './uploads',
  migrationsDir:    process.env['MIGRATIONS_DIR'] ?? './migrations',
  requestTimeoutMs: 30_000,
  maxBodyBytes:     5_242_880, // 5 MB
} satisfies Partial<StreetAppOptions>;
