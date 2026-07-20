import test from 'node:test';
import assert from 'node:assert/strict';

const configured = Boolean(process.env.RAZORPAY_TEST_KEY_ID && process.env.GROQ_API_KEY && process.env.COGNITO_TEST_USER_POOL_ID);

test('provider integration configuration is present', { skip: !configured }, async () => {
  assert.ok(process.env.RAZORPAY_TEST_KEY_SECRET);
  assert.ok(process.env.COGNITO_TEST_CLIENT_ID);
  assert.ok(process.env.TABLE_NAME);
});

test('AWS integration environment is explicitly selected', { skip: process.env.AWS_INTEGRATION !== 'true' }, async () => {
  assert.ok(process.env.AWS_REGION);
});
