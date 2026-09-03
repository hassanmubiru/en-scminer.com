var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Controller, Get, ApiOperation } from 'streetjs';
import { getPool } from './config/database.js';
let HealthController = class HealthController {
    async live(ctx) {
        ctx.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
    }
    async ready(ctx) {
        try {
            const pool = getPool();
            await pool.query('SELECT 1');
            ctx.json({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() });
        }
        catch (err) {
            ctx.json({
                status: 'not_ready',
                database: 'disconnected',
                error: err instanceof Error ? err.message : String(err),
            }, 503);
        }
    }
};
__decorate([
    Get('/'),
    ApiOperation({ summary: 'Liveness check', tags: ['system'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "live", null);
__decorate([
    Get('/ready'),
    ApiOperation({ summary: 'Readiness check — verifies database connection', tags: ['system'] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "ready", null);
HealthController = __decorate([
    Controller('/health')
], HealthController);
export { HealthController };
