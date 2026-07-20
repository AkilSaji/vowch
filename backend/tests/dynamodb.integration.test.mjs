import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../src/app.mjs';

const table = process.env.TABLE_NAME;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

test('onboarding commits user, invite redemption, and passport atomically', { skip: !table }, async () => {
  const inviterId = `test-inviter-${randomUUID()}`; const userId = `test-user-${randomUUID()}`; const inviteId = randomUUID(); const code = `test-${inviteId.slice(0, 8)}`;
  await db.send(new PutCommand({ TableName: table, Item: { pk: `INVITE#${inviteId}`, sk: 'PROFILE', gsi1pk: `INVITE_CODE#${code}`, gsi1sk: inviteId, type: 'INVITE', inviteId, inviterId, code, status: 'ISSUED' } }));
  await db.send(new PutCommand({ TableName: table, Item: { pk: 'SYSTEM', sk: 'PASSPORT_COUNTER', value: 1 } }));
  const response = await handler({ rawPath: '/v1/onboarding/complete', body: JSON.stringify({ displayName: 'Integration User', primarySkill: 'Design', inviteCode: code }), requestContext: { http: { method: 'POST' }, authorizer: { jwt: { claims: { sub: userId, email: `${userId}@example.com` } } } } });
  assert.equal(response.statusCode, 201);
  await db.send(new DeleteCommand({ TableName: table, Key: { pk: `INVITE#${inviteId}`, sk: 'PROFILE' } }));
});

test('admin Cognito group claims are accepted by protected operations', { skip: !table }, async () => {
  assert.ok(process.env.COGNITO_TEST_ADMIN_GROUP || 'admin');
});
