import test from 'node:test';
import assert from 'node:assert/strict';
import { adminContext, adminPermissionFor, hasAdminPermission } from '../src/auth/permissions.mjs';
import { handler } from '../src/app.mjs';

const eventFor = (claims) => ({ requestContext: { authorizer: { jwt: { claims } } } });

test('super admins retain full admin access through legacy and Cognito group claims', () => {
  assert.equal(hasAdminPermission(eventFor({ 'custom:role': 'admin' }), 'payments:reconcile'), true);
  assert.equal(hasAdminPermission(eventFor({ 'cognito:groups': 'vowch-super-admin' }), 'passports:revoke'), true);
});

test('reviewer permissions are scoped to their operational domain', () => {
  const event = eventFor({ 'cognito:groups': 'vowch-trust-reviewer,vowch-support-viewer' });
  assert.deepEqual(adminContext(event).roles, ['TRUST_REVIEWER', 'SUPPORT_VIEWER']);
  assert.equal(hasAdminPermission(event, 'identity:resolve'), true);
  assert.equal(hasAdminPermission(event, 'payments:reconcile'), false);
});

test('admin routes resolve to their least-privilege permission', () => {
  assert.equal(adminPermissionFor('/v1/admin/identity-reviews/review-1/approve', 'POST'), 'identity:resolve');
  assert.equal(adminPermissionFor('/v1/admin/payments/payment-1', 'GET'), 'payments:read');
  assert.equal(adminPermissionFor('/v1/admin/gigs/gig-1/dispute', 'POST'), 'disputes:resolve');
  assert.equal(adminPermissionFor('/v1/gigs', 'GET'), null);
});

test('admin dashboard rejects an authenticated caller without an admin role before accessing storage', async () => {
  const response = await handler({ rawPath: '/v1/admin/dashboard/summary', requestContext: { http: { method: 'GET' }, authorizer: { jwt: { claims: { sub: 'member-1' } } } } });
  assert.equal(response.statusCode, 403);
  assert.equal(JSON.parse(response.body).error, 'ADMIN_PERMISSION_REQUIRED');
});
