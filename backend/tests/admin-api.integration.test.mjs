import test from 'node:test';
import assert from 'node:assert/strict';

const enabled = process.env.AWS_INTEGRATION === 'true';
const baseUrl = String(process.env.VOWCH_API_URL || '').replace(/\/$/, '');
const adminToken = process.env.COGNITO_ADMIN_TEST_TOKEN;
const request = (path) => fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${adminToken}` } });

test('admin integration configuration includes a dedicated admin token', { skip: !enabled }, () => {
  for (const key of ['VOWCH_API_URL', 'COGNITO_ADMIN_TEST_TOKEN']) assert.ok(process.env[key], `${key} is required`);
});

test('deployed admin dashboard and directories are reachable by an admin', { skip: !enabled }, async () => {
  for (const path of ['/v1/admin/dashboard/summary', '/v1/admin/users?limit=1', '/v1/admin/gigs?limit=1', '/v1/admin/payments?limit=1']) {
    const response = await request(path);
    assert.equal(response.status, 200, `${path} returned ${response.status}: ${await response.text()}`);
  }
});
