/** All monetary values are stored as integer cents (BIGINT in Postgres).
 *  Never use floating-point arithmetic for money. */

export function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(centsToDollars(cents));
}

export function addCents(...values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0);
}

export function multiplyCents(cents: number, qty: number): number {
  return Math.round(cents * qty);
}
