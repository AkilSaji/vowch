import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const table = process.env.TABLE_NAME;
if (!table) throw new Error('TABLE_NAME is required');
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
let lastKey; let updated = 0; let skipped = 0;
const indexFor = (item) => {
  if (item.type === 'NOTIFICATION_OUTBOX' && item.status === 'PENDING') return ['OUTBOX#PENDING', `${item.availableAt || item.createdAt}#${item.notificationId || item.sk}`];
  if (item.type === 'TRUST_CASE' && item.reason === 'MISREPRESENTED_SKILL') return ['TRUST_SENTINEL#MISREPRESENTED_SKILL', `${item.createdAt || ''}#${item.caseId || item.pk}`];
  if (item.type === 'RATING' && item.visible !== true && item.revealAt) return ['RATING_REVEAL#PENDING', `${item.revealAt}#${item.gigId || item.pk}#${item.reviewerId || item.sk}`];
  if (item.type === 'GIG' && ['OPEN', 'OFFER_PENDING'].includes(item.status) && item.deadlineAt) return [`GIG_EXPIRY#${item.status}`, `${item.deadlineAt}#${item.gigId}`];
  if (item.type === 'ESCROW_ORDER' && item.status) { const date = item.status === 'CAPTURED' ? item.reviewWindowEndsAt : item.updatedAt || item.createdAt; return [`PAYMENT_STATUS#${item.status}`, `${date}#${item.orderId}`]; }
  return null;
};
do {
  const page = await db.send(new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey }));
  for (const item of page.Items || []) {
    const index = indexFor(item); if (!index) { skipped += 1; continue; }
    if (item.gsi2pk === index[0] && item.gsi2sk === index[1]) { skipped += 1; continue; }
    await db.send(new UpdateCommand({ TableName: table, Key: { pk: item.pk, sk: item.sk }, UpdateExpression: 'SET gsi2pk = :pk, gsi2sk = :sk', ExpressionAttributeValues: { ':pk': index[0], ':sk': index[1] } })); updated += 1;
  }
  lastKey = page.LastEvaluatedKey;
} while (lastKey);
await db.send(new PutCommand({ TableName: table, Item: { pk: 'SYSTEM', sk: 'MIGRATION#003', type: 'MIGRATION', name: 'worker-gsi2-index-backfill', updated, skipped, appliedAt: new Date().toISOString() } }));
console.log(JSON.stringify({ updated, skipped }));
