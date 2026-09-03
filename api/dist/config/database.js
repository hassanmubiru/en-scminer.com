import { PgPool } from 'streetjs';
let pool = null;
export function getPool() {
    if (!pool) {
        const url = process.env['DATABASE_URL'];
        if (!url)
            throw new Error('DATABASE_URL environment variable is required');
        // Parse postgresql://user:password@host:port/database
        const parsed = new URL(url);
        pool = new PgPool({
            host: parsed.hostname,
            port: parseInt(parsed.port || '5432', 10),
            user: decodeURIComponent(parsed.username),
            password: decodeURIComponent(parsed.password),
            database: parsed.pathname.slice(1), // remove leading /
            maxConnections: 20,
        });
    }
    return pool;
}
export async function closePool() {
    if (pool) {
        await pool.close();
        pool = null;
    }
}
