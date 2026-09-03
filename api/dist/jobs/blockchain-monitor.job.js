import { getPool } from '../config/database.js';
import { CryptoService } from '../crypto/crypto.service.js';
const svc = new CryptoService();
/**
 * Poll for blockchain confirmations on pending payments.
 * In production, integrate with:
 *   BTC:  Bitcoin Core RPC / Blockstream API
 *   ETH:  Etherscan API / Infura/Alchemy
 *   TRON: TronGrid API
 *
 * This job runs on an interval (e.g. every 30s) and checks
 * for transactions to the receiving wallet addresses.
 */
export async function runBlockchainMonitorJob() {
    const pool = getPool();
    try {
        // Find payments waiting for blockchain confirmation
        const res = await pool.query(`SELECT p.id, p.wallet_id, p.crypto_amount, p.expires_at,
              sa.symbol, sa.network, sa.contract_address,
              w.address AS receiving_address
       FROM payments p
       JOIN supported_assets sa ON sa.id = p.asset_id
       JOIN wallets w ON w.id = p.wallet_id
       WHERE p.status IN ('AWAITING_PAYMENT','PAYMENT_DETECTED','CONFIRMING')
         AND p.expires_at > NOW()
       LIMIT 50`);
        for (const row of res.rows) {
            await checkPayment(row);
        }
    }
    catch (err) {
        console.error('[jobs] blockchain-monitor error:', err);
    }
}
async function checkPayment(payment) {
    const symbol = String(payment['symbol']);
    const network = String(payment['network']);
    const address = String(payment['receiving_address']);
    try {
        if (symbol === 'BTC') {
            await checkBitcoin(String(payment['id']), address);
        }
        else if (symbol === 'ETH') {
            await checkEthereum(String(payment['id']), address, null);
        }
        else if (symbol === 'USDT' && network === 'ETHEREUM') {
            const contract = String(payment['contract_address'] ?? '0xdac17f958d2ee523a2206206994597c13d831ec7');
            await checkEthereum(String(payment['id']), address, contract);
        }
        else if (symbol === 'USDT' && network === 'TRON') {
            await checkTron(String(payment['id']), address);
        }
    }
    catch (err) {
        console.error(`[jobs] Error checking ${symbol}/${network} for payment ${payment['id']}:`, err);
    }
}
async function checkBitcoin(paymentId, address) {
    const btcRpc = process.env['BTC_RPC_URL'];
    if (!btcRpc)
        return; // Not configured
    const resp = await fetch(btcRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '1.0', method: 'listreceivedbyaddress',
            params: [0, false, true, address], id: paymentId,
        }),
        signal: AbortSignal.timeout(10_000),
    });
    const data = await resp.json();
    const result = data['result']?.[0];
    if (!result)
        return;
    const txids = result['txids'];
    if (!txids?.length)
        return;
    // Process each transaction
    for (const txHash of txids) {
        const txResp = await fetch(btcRpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '1.0', method: 'gettransaction', params: [txHash], id: txHash }),
            signal: AbortSignal.timeout(10_000),
        });
        const txData = await txResp.json();
        const tx = txData['result'];
        if (!tx)
            continue;
        const amount = String(Math.abs(Number(result['amount'])));
        const confirmations = Number(tx['confirmations'] ?? 0);
        await svc.processDetectedTransaction(paymentId, txHash, 'BITCOIN', '', address, amount, 'BTC', confirmations);
    }
}
async function checkEthereum(paymentId, address, contractAddress) {
    const ethRpc = process.env['ETH_RPC_URL'];
    if (!ethRpc)
        return;
    // Get the latest block number to calculate confirmations
    const blockResp = await fetch(ethRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
        signal: AbortSignal.timeout(10_000),
    });
    const blockData = await blockResp.json();
    const latestBlock = parseInt(String(blockData['result'] ?? '0x0'), 16);
    if (contractAddress) {
        // ERC-20 token transfer event (topic0 = Transfer event)
        const logsResp = await fetch(ethRpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0', method: 'eth_getLogs',
                params: [{
                        address: contractAddress,
                        topics: [
                            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                            null,
                            `0x000000000000000000000000${address.toLowerCase().replace('0x', '')}`,
                        ],
                        fromBlock: `0x${Math.max(0, latestBlock - 100).toString(16)}`,
                        toBlock: 'latest',
                    }],
                id: 2,
            }),
            signal: AbortSignal.timeout(10_000),
        });
        const logsData = await logsResp.json();
        const logs = logsData['result'] ?? [];
        for (const log of logs) {
            const txHash = String(log['transactionHash']);
            const blockNum = parseInt(String(log['blockNumber'] ?? '0x0'), 16);
            const confirmations = latestBlock - blockNum;
            const rawAmount = BigInt(String(log['data'] ?? '0x0'));
            const amount = (Number(rawAmount) / 1e6).toFixed(6); // USDT has 6 decimals
            await svc.processDetectedTransaction(paymentId, txHash, 'ETHEREUM', '', address, amount, 'USDT', confirmations);
        }
    }
}
async function checkTron(paymentId, address) {
    const tronUrl = process.env['TRON_API_URL'];
    if (!tronUrl)
        return;
    const resp = await fetch(`${tronUrl}/v1/accounts/${address}/transactions/trc20?limit=20&contract_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok)
        return;
    const data = await resp.json();
    const txs = data['data'] ?? [];
    for (const tx of txs) {
        const txHash = String(tx['transaction_id']);
        const value = String(tx['value'] ?? '0');
        const amount = (Number(value) / 1e6).toFixed(6);
        const confirmed = Boolean(tx['confirmed']);
        if (!confirmed)
            continue;
        await svc.processDetectedTransaction(paymentId, txHash, 'TRON', '', address, amount, 'USDT', 20);
    }
}
