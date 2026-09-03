import { Injectable } from 'streetjs';
import { randomUUID } from 'node:crypto';
import { getPool } from '../config/database.js';

export interface CryptoPaymentIntent {
  id: string;
  orderId: string;
  method: string;
  assetSymbol: string;
  network: string;
  receivingAddress: string;
  cryptoAmount: string;
  exchangeRate: string;
  fiatAmountCents: number;
  currency: string;
  expiresAt: string;
  status: string;
}

@Injectable()
export class CryptoService {

  async getSupportedAssets(): Promise<unknown[]> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT id, symbol, name, network, decimals FROM supported_assets WHERE enabled = true ORDER BY symbol`,
    );
    return res.rows;
  }

  async createPaymentIntent(
    orderId: string, assetId: string, userId: string,
  ): Promise<CryptoPaymentIntent> {
    const pool = getPool();

    // Verify order belongs to user and is awaiting payment
    const orderRes = await pool.query(
      `SELECT id, total_cents, currency, status FROM orders WHERE id = $1 AND user_id = $2`,
      [orderId, userId],
    );
    if (!orderRes.rows[0]) throw new Error('Order not found');
    const order = orderRes.rows[0] as Record<string, unknown>;
    if (!['PENDING_PAYMENT','PAYMENT_PROCESSING'].includes(String(order['status']))) {
      throw new Error('Order is not awaiting payment');
    }

    // Get asset details
    const assetRes = await pool.query(
      `SELECT * FROM supported_assets WHERE id = $1 AND enabled = true`, [assetId],
    );
    if (!assetRes.rows[0]) throw new Error('Crypto asset not found or disabled');
    const asset = assetRes.rows[0] as Record<string, unknown>;

    // Get receiving wallet
    const walletRes = await pool.query(
      `SELECT id, address FROM wallets WHERE asset_id = $1 AND active = true LIMIT 1`, [assetId],
    );
    if (!walletRes.rows[0]) throw new Error(`No active wallet configured for ${asset['symbol']} on ${asset['network']}`);
    const wallet = walletRes.rows[0] as Record<string, unknown>;

    // Get exchange rate from server — never from client
    const rate = await this.fetchExchangeRate(String(asset['symbol']));
    const totalCents = Number(order['total_cents']);
    const cryptoAmount = (totalCents / 100 / rate).toFixed(Number(asset['decimals']) > 8 ? 8 : 6);

    const expiryMinutes = parseInt(process.env['CRYPTO_PAYMENT_EXPIRY_MINUTES'] ?? '30', 10);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const method = this.assetToMethod(String(asset['symbol']), String(asset['network']));
    const paymentId = randomUUID();
    const idempotencyKey = `${orderId}:${assetId}:${Date.now()}`;

    await pool.query(
      `INSERT INTO payments
         (id, order_id, method, status, amount_cents, currency,
          asset_id, wallet_id, crypto_amount, exchange_rate,
          rate_expires_at, expires_at, idempotency_key)
       VALUES ($1,$2,$3,'AWAITING_PAYMENT',$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [paymentId, orderId, method, totalCents, String(order['currency']),
       assetId, wallet['id'], cryptoAmount, rate.toFixed(8),
       new Date(Date.now() + 15 * 60 * 1000).toISOString(),
       expiresAt.toISOString(), idempotencyKey],
    );

    // Record payment event
    await this.recordEvent(paymentId, 'PAYMENT_INTENT_CREATED', {
      assetId, walletId: wallet['id'], cryptoAmount, rate,
    });

    // Update order status
    await pool.query(
      `UPDATE orders SET status = 'PAYMENT_PROCESSING', updated_at = NOW() WHERE id = $1`, [orderId],
    );

    return {
      id:              paymentId,
      orderId,
      method,
      assetSymbol:     String(asset['symbol']),
      network:         String(asset['network']),
      receivingAddress: String(wallet['address']),
      cryptoAmount,
      exchangeRate:    rate.toFixed(8),
      fiatAmountCents: totalCents,
      currency:        String(order['currency']),
      expiresAt:       expiresAt.toISOString(),
      status:          'AWAITING_PAYMENT',
    };
  }

  async getPaymentStatus(paymentId: string, userId: string): Promise<Record<string, unknown>> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT p.*, w.address AS receiving_address, sa.symbol, sa.network
       FROM payments p
       LEFT JOIN wallets w ON w.id = p.wallet_id
       LEFT JOIN supported_assets sa ON sa.id = p.asset_id
       JOIN orders o ON o.id = p.order_id
       WHERE p.id = $1 AND o.user_id = $2`,
      [paymentId, userId],
    );
    if (!res.rows[0]) throw new Error('Payment not found');
    const p = res.rows[0] as Record<string, unknown>;

    const eventsRes = await pool.query(
      `SELECT event, data, created_at FROM payment_events WHERE payment_id = $1 ORDER BY created_at`,
      [paymentId],
    );

    return {
      ...p,
      events: eventsRes.rows,
      amount: Number(p['amount_cents']) / 100,
      isExpired: p['expires_at'] ? new Date(String(p['expires_at'])) < new Date() : false,
    };
  }

  /** Called by blockchain monitor job when a transaction is detected */
  async processDetectedTransaction(
    paymentId: string,
    txHash: string, network: string, fromAddress: string, toAddress: string,
    amount: string, assetSymbol: string, confirmations: number,
  ): Promise<void> {
    const pool = getPool();

    // Prevent duplicate credit — unique constraint on (network, transaction_hash)
    const existing = await pool.query(
      `SELECT id, credited FROM blockchain_transactions WHERE network = $1 AND transaction_hash = $2`,
      [network, txHash],
    );
    if (existing.rows[0]) {
      const row = existing.rows[0] as Record<string, unknown>;
      if (row['credited']) return; // Already credited
    }

    // Get payment details
    const paymentRes = await pool.query(
      `SELECT p.*, sa.confirmation_requirements
       FROM payments p
       LEFT JOIN supported_assets sa ON sa.id = p.asset_id
       WHERE p.id = $1`, [paymentId],
    );
    if (!paymentRes.rows[0]) return;
    const payment = paymentRes.rows[0] as Record<string, unknown>;

    // Verify receiving address matches
    const walletRes = await pool.query(`SELECT address FROM wallets WHERE id = $1`, [payment['wallet_id']]);
    const walletAddress = walletRes.rows[0] ? String((walletRes.rows[0] as Record<string,unknown>)['address']) : null;
    if (walletAddress && toAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      await this.recordEvent(paymentId, 'WRONG_ADDRESS', { expected: walletAddress, received: toAddress });
      return;
    }

    const requiredConfirmations = Number(payment['confirmation_requirements'] ?? 3);
    const txId = existing.rows[0]
      ? String((existing.rows[0] as Record<string, unknown>)['id'])
      : randomUUID();

    if (!existing.rows[0]) {
      await pool.query(
        `INSERT INTO blockchain_transactions
           (id, payment_id, network, transaction_hash, from_address, to_address,
            amount, asset_symbol, confirmations, required_confirmations, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING')`,
        [txId, paymentId, network, txHash, fromAddress, toAddress,
         amount, assetSymbol, confirmations, requiredConfirmations],
      );
      await pool.query(
        `UPDATE payments SET status = 'PAYMENT_DETECTED', updated_at = NOW() WHERE id = $1`, [paymentId],
      );
      await this.recordEvent(paymentId, 'TRANSACTION_DETECTED', { txHash, amount, confirmations });
    } else {
      await pool.query(
        `UPDATE blockchain_transactions SET confirmations = $1, updated_at = NOW() WHERE id = $2`,
        [confirmations, txId],
      );
    }

    const expectedAmount = Number(payment['crypto_amount']);
    const receivedAmount = Number(amount);
    const tolerance = expectedAmount * 0.001; // 0.1% tolerance

    if (confirmations >= requiredConfirmations) {
      let newStatus: string;

      if (receivedAmount < expectedAmount - tolerance) {
        newStatus = 'UNDERPAID';
        await this.recordEvent(paymentId, 'PAYMENT_UNDERPAID', { expected: expectedAmount, received: receivedAmount });
      } else if (receivedAmount > expectedAmount + tolerance) {
        newStatus = 'OVERPAID';
        await this.recordEvent(paymentId, 'PAYMENT_OVERPAID', { expected: expectedAmount, received: receivedAmount });
      } else {
        newStatus = 'CONFIRMED';
        await this.recordEvent(paymentId, 'PAYMENT_CONFIRMED', { txHash, amount, confirmations });
        // Mark order as PAID only after valid confirmed payment
        await pool.query(
          `UPDATE orders SET status = 'PAID', updated_at = NOW() WHERE id = $1`,
          [payment['order_id']],
        );
      }

      await pool.query(
        `UPDATE payments SET status = $1, crypto_amount_received = $2, updated_at = NOW() WHERE id = $3`,
        [newStatus, receivedAmount, paymentId],
      );
      await pool.query(
        `UPDATE blockchain_transactions SET status = 'CONFIRMED', credited = true, updated_at = NOW() WHERE id = $1`,
        [txId],
      );
    } else {
      await pool.query(
        `UPDATE payments SET status = 'CONFIRMING', updated_at = NOW() WHERE id = $1`, [paymentId],
      );
      await this.recordEvent(paymentId, 'PAYMENT_CONFIRMING', { confirmations, required: requiredConfirmations });
    }
  }

  async expirePayments(): Promise<number> {
    const pool = getPool();
    const res = await pool.query(
      `UPDATE payments SET status = 'EXPIRED', updated_at = NOW()
       WHERE status = 'AWAITING_PAYMENT' AND expires_at < NOW()
       RETURNING id, order_id`,
    );
    for (const row of res.rows as Array<Record<string, unknown>>) {
      await this.recordEvent(String(row['id']), 'PAYMENT_EXPIRED', {});
    }
    return res.rows.length;
  }

  private async fetchExchangeRate(symbol: string): Promise<number> {
    // Production: call CoinGecko / CoinMarketCap API
    // For USDT variants — peg to 1.0
    if (symbol.toUpperCase().startsWith('USDT')) return 1.0;

    const coinMap: Record<string, string> = {
      BTC: 'bitcoin',
      ETH: 'ethereum',
    };
    const coinId = coinMap[symbol.toUpperCase()];
    if (!coinId) throw new Error(`No rate provider configured for ${symbol}`);

    const apiKey = process.env['COINGECKO_API_KEY'] ?? '';
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd${apiKey ? `&x_cg_api_key=${apiKey}` : ''}`;

    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!resp.ok) throw new Error(`CoinGecko returned ${resp.status}`);
      const data = await resp.json() as Record<string, Record<string, number>>;
      const price = data[coinId]?.['usd'];
      if (!price) throw new Error(`No price returned for ${symbol}`);
      return price;
    } catch (err) {
      throw new Error(`Failed to fetch exchange rate for ${symbol}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private assetToMethod(symbol: string, network: string): string {
    if (symbol === 'BTC')  return 'BTC';
    if (symbol === 'ETH')  return 'ETH';
    if (symbol === 'USDT' && network === 'ETHEREUM') return 'USDT_ERC20';
    if (symbol === 'USDT' && network === 'TRON')     return 'USDT_TRC20';
    if (symbol === 'USDT' && network === 'BSC')      return 'USDT_BEP20';
    return 'BANK_WIRE';
  }

  private async recordEvent(paymentId: string, event: string, data: Record<string, unknown>): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO payment_events (id, payment_id, event, data) VALUES ($1,$2,$3,$4)`,
      [randomUUID(), paymentId, event, JSON.stringify(data)],
    );
  }
}
