import { CryptoService } from '../crypto/crypto.service.js';

const svc = new CryptoService();

/** Run every 60 seconds — expire crypto payments past their deadline */
export async function runPaymentExpiryJob(): Promise<void> {
  try {
    const expired = await svc.expirePayments();
    if (expired > 0) {
      console.log(`[jobs] Expired ${expired} payment(s)`);
    }
  } catch (err) {
    console.error('[jobs] payment-expiry error:', err);
  }
}
