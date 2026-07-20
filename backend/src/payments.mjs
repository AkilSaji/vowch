import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
const ssm = new SSMClient({}); const cache = new Map();
async function secret(name, fallback = '') { if (cache.has(name)) return cache.get(name); try { const r = await ssm.send(new GetParameterCommand({ Name: `${process.env.SSM_PREFIX || ''}/${name}`, WithDecryption: true })); const v = r.Parameter?.Value || fallback; cache.set(name, v); return v; } catch { return fallback; } }
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function razorpayRequest(path, body, idempotencyKey) {
  const keyId = await secret('razorpay/key-id', process.env.RAZORPAY_KEY_ID); const keySecret = await secret('razorpay/key-secret', process.env.RAZORPAY_KEY_SECRET); if (!keyId || !keySecret) throw new Error('PAYMENTS_NOT_CONFIGURED');
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64'); let last;
  for (let attempt = 0; attempt < 3; attempt += 1) { try { const response = await fetch(`https://api.razorpay.com/v1${path}`, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotencyKey }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) }); if (response.ok) return await response.json(); last = new Error(`RAZORPAY_${response.status}`); if (response.status < 500) throw last; } catch (error) { last = error; if (!String(error.message).startsWith('RAZORPAY_5')) break; } await wait(250 * (attempt + 1)); }
  throw last || new Error('RAZORPAY_REQUEST_FAILED');
}
export async function razorpayGet(path) { const keyId = await secret('razorpay/key-id', process.env.RAZORPAY_KEY_ID); const keySecret = await secret('razorpay/key-secret', process.env.RAZORPAY_KEY_SECRET); if (!keyId || !keySecret) throw new Error('PAYMENTS_NOT_CONFIGURED'); const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64'); const response = await fetch(`https://api.razorpay.com/v1${path}`, { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(8000) }); if (!response.ok) throw new Error(`RAZORPAY_${response.status}`); return response.json(); }
export const refundPayment = (paymentId, amount, notes, key) => razorpayRequest(`/payments/${paymentId}/refund`, { amount, notes }, key);
export const releaseTransfer = (paymentId, account, amount, notes, key) => razorpayRequest(`/payments/${paymentId}/transfers`, { transfers: [{ account, amount, currency: 'INR', notes, on_hold: false }] }, key);
export const splitTransfer = (paymentId, transfers, key) => razorpayRequest(`/payments/${paymentId}/transfers`, { transfers: transfers.map((x) => ({ ...x, currency: 'INR', on_hold: false })) }, key);
export const createOrder = (amount, receipt, notes, key) => razorpayRequest('/orders', { amount, currency: 'INR', receipt, notes }, key);
