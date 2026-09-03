import { randomBytes } from 'node:crypto';

/** Generates a human-readable order number: SC-YYYYMMDD-XXXXXX */
export function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `SC-${date}-${rand}`;
}
