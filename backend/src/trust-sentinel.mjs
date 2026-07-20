import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const now = () => new Date().toISOString();

// Automation only creates a review/suspension recommendation. Revocation and its
// lineage cascade remain an explicitly confirmed administrator action.
export const handler = async () => {
  const cases = await db.send(new QueryCommand({ TableName: process.env.TABLE_NAME, IndexName: 'gsi2', KeyConditionExpression: 'gsi2pk = :pk', ExpressionAttributeValues: { ':pk': 'TRUST_SENTINEL#MISREPRESENTED_SKILL' } }));
  const strikes = new Map(); for (const item of cases.Items || []) strikes.set(item.subjectId, (strikes.get(item.subjectId) || 0) + 1);
  let flagged = 0;
  for (const [subjectId, count] of strikes) {
    if (count < 3) continue;
    const profile = (await db.send(new GetCommand({ TableName: process.env.TABLE_NAME, Key: { pk: `USER#${subjectId}`, sk: 'PROFILE' } }))).Item; if (!profile || profile.accountStatus === 'SUSPENDED') continue;
    const at = now(); await db.send(new PutCommand({ TableName: process.env.TABLE_NAME, Item: { ...profile, accountStatus: 'SUSPENDED', suspensionReason: 'TRUST_SENTINEL_THREE_MISREPRESENTATION_STRIKES', suspendedAt: at, updatedAt: at } }));
    await db.send(new PutCommand({ TableName: process.env.TABLE_NAME, Item: { pk: `TRUST_ALERT#${subjectId}`, sk: 'PROFILE', type: 'TRUST_SENTINEL_ALERT', subjectId, strikeCount: count, status: 'PENDING_ADMIN_REVIEW', reason: 'THREE_MISREPRESENTATION_STRIKES', createdAt: at } })); flagged += 1;
  }
  return { subjectsEvaluated: strikes.size, flagged };
};
