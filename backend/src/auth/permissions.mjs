const ROLE_PERMISSIONS = Object.freeze({
  SUPER_ADMIN: ['*'],
  TRUST_REVIEWER: ['admin:access', 'identity:read', 'identity:resolve', 'skills:read', 'skills:resolve', 'trust:read', 'trust:resolve', 'passports:read', 'passports:revoke', 'users:moderate', 'proof:read', 'proof:resolve', 'audit:read'],
  OPS_REVIEWER: ['admin:access', 'gigs:read', 'proof:read', 'proof:resolve', 'disputes:read', 'communities:read', 'notifications:read', 'audit:read'],
  FINANCE_REVIEWER: ['admin:access', 'payments:read', 'payments:reconcile', 'disputes:read', 'disputes:resolve', 'audit:read'],
  SUPPORT_VIEWER: ['admin:access', 'users:read', 'gigs:read', 'payments:read', 'trust:read', 'passports:read', 'notifications:read', 'audit:read'],
});

const ROLE_ALIASES = Object.freeze({
  admin: 'SUPER_ADMIN', founder: 'SUPER_ADMIN', 'vowch-super-admin': 'SUPER_ADMIN',
  'vowch-trust-reviewer': 'TRUST_REVIEWER', 'vowch-ops-reviewer': 'OPS_REVIEWER',
  'vowch-finance-reviewer': 'FINANCE_REVIEWER', 'vowch-support-viewer': 'SUPPORT_VIEWER',
});

const claimRoles = (claims = {}) => {
  const raw = [claims['custom:role'], claims.role, claims['cognito:groups']].filter(Boolean).flatMap((value) => String(value).split(','));
  return [...new Set(raw.map((value) => ROLE_ALIASES[value.trim()] || value.trim()).filter((value) => ROLE_PERMISSIONS[value]))];
};

export const adminContext = (event) => {
  const claims = event.requestContext?.authorizer?.jwt?.claims || event.requestContext?.authorizer?.claims || {};
  const roles = claimRoles(claims);
  return { roles, permissions: [...new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role]))] };
};

export const hasAdminPermission = (event, permission = 'admin:access') => {
  const { permissions } = adminContext(event);
  return permissions.includes('*') || permissions.includes(permission);
};

export const adminPermissionFor = (path, method) => {
  if (!path.startsWith('/v1/admin/')) return null;
  if (path.startsWith('/v1/admin/access')) return 'admin:manage';
  if (path.startsWith('/v1/admin/dashboard')) return 'admin:access';
  if (path.startsWith('/v1/admin/identity-reviews')) return method === 'GET' ? 'identity:read' : 'identity:resolve';
  if (path.startsWith('/v1/admin/skill-reviews')) return method === 'GET' ? 'skills:read' : 'skills:resolve';
  if (path.startsWith('/v1/admin/trust-cases')) return method === 'GET' ? 'trust:read' : 'trust:resolve';
  if (path.startsWith('/v1/admin/proof-review')) return method === 'GET' ? 'proof:read' : 'proof:resolve';
  if (path.startsWith('/v1/admin/disputes')) return 'disputes:read';
  if (path.startsWith('/v1/admin/gigs/') && path.endsWith('/dispute')) return method === 'GET' ? 'disputes:read' : 'disputes:resolve';
  if (path.startsWith('/v1/admin/payments')) return method === 'GET' ? 'payments:read' : 'payments:reconcile';
  if (path.startsWith('/v1/admin/users/') && path.endsWith('/suspend')) return 'users:moderate';
  if (path.startsWith('/v1/admin/users')) return 'users:read';
  if (path.startsWith('/v1/admin/passports/') && path.endsWith('/revoke')) return 'passports:revoke';
  if (path.startsWith('/v1/admin/passports') || path.startsWith('/v1/admin/orphans')) return 'passports:read';
  if (path.startsWith('/v1/admin/audit-logs')) return 'audit:read';
  if (path.startsWith('/v1/admin/notification')) return 'notifications:read';
  return 'admin:access';
};

export const requireAdminPermission = (event, permission) => hasAdminPermission(event, permission)
  ? null
  : { statusCode: 403, code: 'ADMIN_PERMISSION_REQUIRED', permission };

export { ROLE_PERMISSIONS };
