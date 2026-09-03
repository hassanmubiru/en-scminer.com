import 'reflect-metadata';

import {
  streetApp,
  container,
  securityHeaders,
  corsMiddleware,
  xssMiddleware,
  RateLimiter,
} from 'streetjs';

import { closePool, getPool } from './config/database.js';
import { authenticate } from './middleware/auth.middleware.js';

// Controllers
import { HealthController }     from './health.controller.js';
import { AuthController }       from './auth/auth.controller.js';
import { CategoryController }   from './categories/category.controller.js';
import { BrandController }      from './brands/brand.controller.js';
import { ProductController }    from './products/product.controller.js';
import { InventoryController }  from './inventory/inventory.controller.js';
import { CartController }       from './cart/cart.controller.js';
import { WishlistController }   from './wishlist/wishlist.controller.js';
import { CompareController }    from './compare/compare.controller.js';
import { ReviewController }     from './reviews/review.controller.js';
import { AddressController }    from './addresses/address.controller.js';
import { ShippingController }   from './shipping/shipping.controller.js';
import { CouponController }     from './coupons/coupon.controller.js';
import { CheckoutController }   from './checkout/checkout.controller.js';
import { OrderController }      from './orders/order.controller.js';
import { CryptoController }     from './crypto/crypto.controller.js';
import { ContactController }    from './contact/contact.controller.js';
import { AdminController }      from './admin/admin.controller.js';

// Services for DI
import { AuthService }          from './auth/auth.service.js';
import { ProductService }       from './products/product.service.js';
import { InventoryService }     from './inventory/inventory.service.js';
import { CartService }          from './cart/cart.service.js';
import { CheckoutService }      from './checkout/checkout.service.js';
import { CryptoService }        from './crypto/crypto.service.js';
import { AuditService }         from './audit/audit.service.js';

// Background jobs
import { runPaymentExpiryJob }     from './jobs/payment-expiry.job.js';
import { runBlockchainMonitorJob } from './jobs/blockchain-monitor.job.js';

async function bootstrap(): Promise<void> {
  const port   = parseInt(process.env['PORT'] ?? '3000', 10);
  const host   = process.env['HOST'] ?? '0.0.0.0';
  const isProd = (process.env['NODE_ENV'] ?? 'development') === 'production';

  // ── CORS configuration ─────────────────────────────────────────────────────
  const corsOrigins = (process.env['CORS_ORIGINS'] ?? '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (corsOrigins.length === 0) {
    if (isProd) throw new Error('CORS_ORIGINS must be configured in production');
    corsOrigins.push('http://localhost:5173', 'http://localhost:4173');
  }

  // ── Validate required env vars in production ───────────────────────────────
  if (isProd) {
    const required = ['DATABASE_URL','JWT_SECRET','SESSION_KEY'];
    for (const key of required) {
      if (!process.env[key]) throw new Error(`${key} environment variable is required in production`);
    }
  }

  // ── Database warm-up ───────────────────────────────────────────────────────
  const pool = getPool();
  await pool.query('SELECT 1'); // fail fast if DB unreachable
  console.log('[scminer] Database connected');

  // ── DI registrations ──────────────────────────────────────────────────────
  const authSvc      = new AuthService();
  const productSvc   = new ProductService();
  const inventorySvc = new InventoryService();
  const cartSvc      = new CartService();
  const checkoutSvc  = new CheckoutService();
  const cryptoSvc    = new CryptoService();
  const auditSvc     = new AuditService();

  container.register(AuthService,      authSvc);
  container.register(ProductService,   productSvc);
  container.register(InventoryService, inventorySvc);
  container.register(CartService,      cartSvc);
  container.register(CheckoutService,  checkoutSvc);
  container.register(CryptoService,    cryptoSvc);
  container.register(AuditService,     auditSvc);

  // ── StreetJS app ───────────────────────────────────────────────────────────
  const app = streetApp({
    port, host,
    requestTimeoutMs: 30_000,
    maxBodyBytes: 5_242_880, // 5 MB
  });

  // ── Global middleware ──────────────────────────────────────────────────────
  app.use(securityHeaders);
  app.use(corsMiddleware(corsOrigins));
  app.use(xssMiddleware);

  // Rate limiting — tighter limits on auth/payment endpoints
  const globalLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 300 });
  const authLimiter   = new RateLimiter({ windowMs: 60_000, maxRequests: 20  });
  const payLimiter    = new RateLimiter({ windowMs: 60_000, maxRequests: 10  });

  app.use(globalLimiter.middleware());

  app.use(async (ctx, next) => {
    const path = ctx.path;
    if (path.startsWith('/api/v1/auth/login') || path.startsWith('/api/v1/auth/register')) {
      return authLimiter.middleware()(ctx, next);
    }
    if (path.startsWith('/api/v1/crypto/payment-intents') || path.startsWith('/api/v1/orders')) {
      return payLimiter.middleware()(ctx, next);
    }
    await next();
  });

  // JWT authentication — populates ctx.user on every request that carries a Bearer token
  app.use(authenticate);

  // Request ID for tracing
  app.use(async (ctx, next) => {
    const reqId = ctx.headers['x-request-id'] ?? crypto.randomUUID();
    (ctx as unknown as Record<string,unknown>)['requestId'] = reqId;
    await next();
  });

  // ── Register controllers ───────────────────────────────────────────────────
  app.registerController(HealthController);
  app.registerController(AuthController);
  app.registerController(CategoryController);
  app.registerController(BrandController);
  app.registerController(ProductController);
  app.registerController(InventoryController);
  app.registerController(CartController);
  app.registerController(WishlistController);
  app.registerController(CompareController);
  app.registerController(ReviewController);
  app.registerController(AddressController);
  app.registerController(ShippingController);
  app.registerController(CouponController);
  app.registerController(CheckoutController);
  app.registerController(OrderController);
  app.registerController(CryptoController);
  app.registerController(ContactController);
  app.registerController(AdminController);

  // ── OpenAPI spec endpoint ──────────────────────────────────────────────────
  // NOTE: Must be registered as a controller route, not app.use(), because
  // app.use() middlewares run BEFORE the router dispatch step. Any middleware
  // added via app.use() that doesn't call next() will short-circuit routing.
  const spec = app.openApiSpec();
  app.use(async (ctx, next) => {
    if (ctx.path === '/openapi.json' && ctx.method === 'GET') {
      ctx.json(spec); return;
    }
    await next();
  });

  // ── Background jobs ────────────────────────────────────────────────────────
  const paymentExpiryInterval    = setInterval(runPaymentExpiryJob,    60_000);  // every 60s
  const blockchainMonitorInterval = setInterval(runBlockchainMonitorJob, 30_000); // every 30s

  // Initial runs
  void runPaymentExpiryJob();

  // ── Start ──────────────────────────────────────────────────────────────────
  await app.listen(port, host);
  console.log(`[scminer] API running on http://${host}:${port}`);
  console.log(`[scminer] OpenAPI spec: http://${host}:${port}/openapi.json`);
  console.log(`[scminer] Environment: ${isProd ? 'production' : 'development'}`);

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[scminer] ${signal} received — shutting down...`);
    clearInterval(paymentExpiryInterval);
    clearInterval(blockchainMonitorInterval);
    try {
      await app.close();
      await closePool();
      globalLimiter.destroy();
      authLimiter.destroy();
      payLimiter.destroy();
    } catch (err) {
      console.error('[scminer] Shutdown error:', err);
    }
    process.exit(0);
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[scminer] Fatal startup error:', err);
  process.exit(1);
});
