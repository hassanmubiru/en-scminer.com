/** All monetary values are stored as integer cents (BIGINT in Postgres).
 *  Never use floating-point arithmetic for money. */
export function dollarsToCents(amount) {
    return Math.round(amount * 100);
}
export function centsToDollars(cents) {
    return cents / 100;
}
export function formatCents(cents, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
    }).format(centsToDollars(cents));
}
export function addCents(...values) {
    return values.reduce((sum, v) => sum + v, 0);
}
export function multiplyCents(cents, qty) {
    return Math.round(cents * qty);
}
