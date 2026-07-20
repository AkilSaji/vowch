import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { broadcastToUser } from './realtime.mjs';
import { sendEmail } from './email.mjs';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const now = () => new Date().toISOString();
const retryAt = (attempts) => new Date(Date.now() + Math.min(3600_000 * 24, 60_000 * 2 ** Math.min(attempts, 10))).toISOString();

async function deliverPush(outbox) {
  if (!process.env.PUSH_GATEWAY_URL) return 'SKIPPED';
  const devices = await db.send(new QueryCommand({ TableName: process.env.TABLE_NAME, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)', ExpressionAttributeValues: { ':pk': `USER#${outbox.recipientId}`, ':prefix': 'PUSH_DEVICE#' } }));
  const enabled = (devices.Items || []).filter((device) => device.enabled !== false); if (!enabled.length) return 'SKIPPED';
  const response = await fetch(process.env.PUSH_GATEWAY_URL, { method: 'POST', headers: { 'content-type': 'application/json', ...(process.env.PUSH_GATEWAY_TOKEN ? { authorization: `Bearer ${process.env.PUSH_GATEWAY_TOKEN}` } : {}) }, body: JSON.stringify({ devices: enabled.map(({ token, platform }) => ({ token, platform })), notification: { title: outbox.title || 'Vowch update', body: outbox.message, data: outbox.data || {} } }) });
  if (!response.ok) throw new Error(`PUSH_GATEWAY_${response.status}`); return 'SENT';
}

export const handler = async () => {
  const result = await db.send(new QueryCommand({ TableName: process.env.TABLE_NAME, IndexName: 'gsi2', KeyConditionExpression: 'gsi2pk = :pk AND gsi2sk <= :now', ExpressionAttributeValues: { ':pk': 'OUTBOX#PENDING', ':now': `${now()}\uffff` }, Limit: 50 })); let delivered = 0; let failed = 0;
  for (const outbox of result.Items || []) {
    try {
      const profile = (await db.send(new GetCommand({ TableName: process.env.TABLE_NAME, Key: { pk: `USER#${outbox.recipientId}`, sk: 'PROFILE' } }))).Item; const preferences = profile?.notificationPreferences || { inApp: true, email: true, push: true };
      if (outbox.channels?.includes('EMAIL') && preferences.email !== false && profile?.email) await sendEmail({ to: profile.email, subject: outbox.title || 'Vowch update', text: outbox.message });
      const pushStatus = outbox.channels?.includes('PUSH') && preferences.push !== false ? await deliverPush(outbox) : 'SKIPPED'; const ws = outbox.channels?.includes('WEBSOCKET') && preferences.inApp !== false ? await broadcastToUser(outbox.recipientId, { type: 'NOTIFICATION', notificationId: outbox.notificationId, title: outbox.title, message: outbox.message, data: outbox.data || {} }) : { delivered: 0 };
      await db.send(new UpdateCommand({ TableName: process.env.TABLE_NAME, Key: { pk: outbox.pk, sk: outbox.sk }, UpdateExpression: 'SET #status = :sent, deliveredAt = :now, pushStatus = :push, websocketDeliveries = :ws REMOVE gsi2pk, gsi2sk', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':sent': 'SENT', ':now': now(), ':push': pushStatus, ':ws': ws.delivered } })); delivered += 1;
    } catch (error) { const attempts = Number(outbox.attempts || 0) + 1; const availableAt = retryAt(attempts); await db.send(new UpdateCommand({ TableName: process.env.TABLE_NAME, Key: { pk: outbox.pk, sk: outbox.sk }, UpdateExpression: 'SET attempts = :attempts, availableAt = :availableAt, gsi2sk = :index, lastError = :error', ExpressionAttributeValues: { ':attempts': attempts, ':availableAt': availableAt, ':index': `${availableAt}#${outbox.notificationId}`, ':error': String(error.message || error).slice(0, 1000) } })); failed += 1; }
  }
  return { delivered, failed };
};
