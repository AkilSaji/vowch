import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const table = process.env.TABLE_NAME;
if (!table) throw new Error('TABLE_NAME is required');
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
let lastKey; let migrated = 0;
do {
  const page = await db.send(new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey }));
  for (const gig of (page.Items || []).filter((item) => item.type === 'GIG' && item.gigId && item.posterId)) {
    const sort = gig.createdAt || new Date(0).toISOString();
    await db.send(new UpdateCommand({ TableName: table, Key: { pk: gig.pk, sk: gig.sk }, UpdateExpression: 'SET gsi4pk = :pk, gsi4sk = :sk', ExpressionAttributeValues: { ':pk': `POSTER#${gig.posterId}`, ':sk': sort } }));
    migrated += 1;
  }
  lastKey = page.LastEvaluatedKey;
} while (lastKey);
await db.send(new PutCommand({ TableName: table, Item: { pk: 'SYSTEM', sk: 'MIGRATION#003', type: 'MIGRATION', name: 'gig-poster-index', migrated, appliedAt: new Date().toISOString() } }));
console.log(JSON.stringify({ migrated }));
