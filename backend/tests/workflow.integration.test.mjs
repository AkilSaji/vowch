import test from 'node:test';
import assert from 'node:assert/strict';

// Runs only in an isolated AWS integration environment. The deployed API check is
// the prerequisite for the payment, outbox, websocket, expiry, Sentinel and role scenarios.
const enabled = process.env.AWS_INTEGRATION === 'true';
test('workflow integration environment includes required payment and authenticated API settings', { skip: !enabled }, () => {
  for (const key of ['TABLE_NAME', 'VOWCH_API_URL', 'COGNITO_TEST_TOKEN', 'RAZORPAY_TEST_KEY_ID']) assert.ok(process.env[key], `${key} is required`);
});
test('deployed API health check passes before workflow scenarios', { skip: !enabled }, async () => {
  const response = await fetch(`${process.env.VOWCH_API_URL.replace(/\/$/, '')}/health`); assert.equal(response.status, 200);
});
