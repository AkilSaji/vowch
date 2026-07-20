import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { sendEmail, isEmailConfigured } from './email.mjs';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
export const handler = async () => {
  if (!isEmailConfigured()) return { retried: 0, skipped: 'GMAIL_SMTP_NOT_CONFIGURED' };
  const page = await db.send(new ScanCommand({ TableName: process.env.TABLE_NAME, FilterExpression: '#type = :type AND retryAfter <= :now', ExpressionAttributeNames: { '#type': 'type' }, ExpressionAttributeValues: { ':type': 'NOTIFICATION_DELIVERY_FAILURE', ':now': new Date().toISOString() }, Limit: 50 })); let retried = 0;
  for (const item of page.Items || []) {
    try { const profile = (await db.send(new GetCommand({ TableName: process.env.TABLE_NAME, Key: { pk: `USER#${item.recipientId}`, sk: 'PROFILE' } }))).Item; if (!profile?.email || profile.notificationPreferences?.email === false) { await db.send(new UpdateCommand({ TableName: process.env.TABLE_NAME, Key: { pk: item.pk, sk: item.sk }, UpdateExpression: 'SET deliveryStatus = :skipped, completedAt = :now', ExpressionAttributeValues: { ':skipped': 'SKIPPED', ':now': new Date().toISOString() } })); continue; } await sendEmail({ to: profile.email, subject: 'Vowch update', text: item.message }); await db.send(new UpdateCommand({ TableName: process.env.TABLE_NAME, Key: { pk: item.pk, sk: item.sk }, UpdateExpression: 'SET deliveryStatus = :sent, completedAt = :now', ExpressionAttributeValues: { ':sent': 'SENT', ':now': new Date().toISOString() } })); retried += 1; }
    catch (error) { await db.send(new UpdateCommand({ TableName: process.env.TABLE_NAME, Key: { pk: item.pk, sk: item.sk }, UpdateExpression: 'SET retryCount = if_not_exists(retryCount, :zero) + :one, retryAfter = :retryAfter, lastError = :error', ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':retryAfter': new Date(Date.now() + 60 * 60 * 1000).toISOString(), ':error': String(error.message || error).slice(0, 1000) } })); }
  }
  return { retried };
};
