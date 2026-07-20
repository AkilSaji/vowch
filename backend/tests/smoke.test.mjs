import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../src/app.mjs';

test('health endpoint returns service status', async () => {
  const response = await handler({ rawPath: '/health', requestContext: { http: { method: 'GET' } } });
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).ok, true);
});

test('health endpoint accepts the HTTP API stage-prefixed path', async () => {
  const response = await handler({ rawPath: '/dev/health', requestContext: { stage: 'dev', http: { method: 'GET' } } });
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).ok, true);
});

test('public request validates required fields', async () => {
  const response = await handler({ rawPath: '/v1/public/requests', body: JSON.stringify({ title: 'x' }), requestContext: { http: { method: 'POST' } } });
  assert.equal(response.statusCode, 400);
});

test('protected onboarding rejects unauthenticated callers', async () => {
  const response = await handler({ rawPath: '/v1/onboarding/complete', body: '{}', requestContext: { http: { method: 'POST' } } });
  assert.equal(response.statusCode, 401);
});

test('protected gig feed rejects unauthenticated callers', async () => {
  const response = await handler({ rawPath: '/v1/gigs', requestContext: { http: { method: 'GET' } } });
  assert.equal(response.statusCode, 401);
});

test('invalid JSON is rejected', async () => {
  const response = await handler({ rawPath: '/v1/public/requests', body: '{bad', requestContext: { http: { method: 'POST' } } });
  assert.equal(response.statusCode, 400);
});
