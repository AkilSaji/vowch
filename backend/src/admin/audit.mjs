import { randomUUID } from 'node:crypto';

export const adminAuditRecord = ({ actorId, action, subjectId, requestId, before, after, metadata = {} }) => ({
  pk: `AUDIT#${randomUUID()}`,
  sk: 'PROFILE',
  type: 'AUDIT_LOG',
  gsi4pk: 'AUDIT#ALL',
  gsi4sk: new Date().toISOString(),
  actorId,
  action,
  subjectId,
  requestId,
  before,
  after,
  metadata,
  createdAt: new Date().toISOString(),
});
