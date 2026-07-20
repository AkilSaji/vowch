import { createHash } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const table = process.env.TABLE_NAME;
if (!table) throw new Error('TABLE_NAME is required');
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const passports = [];
let lastKey;
do {
  const page = await db.send(new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey }));
  passports.push(...(page.Items || []).filter((item) => item.type === 'PASSPORT' && item.passportNo && item.userId));
  lastKey = page.LastEvaluatedKey;
} while (lastKey);

const byPassportNo = new Map(passports.map((item) => [item.passportNo, item]));
const byUserId = new Map();
for (const passport of passports.sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)))) {
  if (!byUserId.has(passport.userId)) byUserId.set(passport.userId, passport);
}
const resolved = new Map();
const unresolved = [];
function canonicalise(passport, ancestry = new Set()) {
  if (resolved.has(passport.passportNo)) return resolved.get(passport.passportNo);
  if (ancestry.has(passport.passportNo)) throw new Error(`Passport lineage cycle at ${passport.passportNo}`);
  const parentReference = passport.vowchedBy || null;
  const parent = parentReference ? (byPassportNo.get(parentReference) || byUserId.get(parentReference) || null) : null;
  if (parentReference && !parent) throw new Error(`Unknown parent ${parentReference} for ${passport.passportNo}`);
  const nextAncestry = new Set(ancestry); nextAncestry.add(passport.passportNo);
  const parentCanonical = parent ? canonicalise(parent, nextAncestry) : null;
  const issuedAt = passport.issuedAt || passport.createdAt;
  if (!issuedAt) throw new Error(`Missing issuedAt for ${passport.passportNo}`);
  const canonical = {
    parentPassportNo: parentCanonical?.passportNo || null,
    generation: parentCanonical ? parentCanonical.generation + 1 : 0,
    lineage: parentCanonical ? [...parentCanonical.lineage, passport.passportNo] : [passport.passportNo],
    chainHash: parentCanonical ? createHash('sha256').update(`${passport.passportNo}:${passport.userId}:${issuedAt}:${parentCanonical.chainHash}`).digest('hex') : 'GENESIS'
  };
  resolved.set(passport.passportNo, canonical);
  return canonical;
}

let migrated = 0;
for (const passport of passports) {
  try {
    const canonical = canonicalise(passport);
    const values = {
      ':passportIndex': `PASSPORT_NO#${passport.passportNo}`,
      ':userId': passport.userId,
      ':skill': `SKILL#${passport.primarySkill || 'general'}`,
      ':cred': `${String(Number(passport.cred || 500)).padStart(4, '0')}#${passport.userId}`,
      ':parent': canonical.parentPassportNo,
      ':generation': canonical.generation,
      ':lineage': canonical.lineage,
      ':chainHash': canonical.chainHash
    };
    let expression = 'SET gsi1pk = :passportIndex, gsi1sk = :userId, gsi3pk = :skill, gsi3sk = :cred, vowchedBy = :parent, generation = :generation, lineage = :lineage, chainHash = :chainHash';
    if (canonical.parentPassportNo) {
      values[':vowcherIndex'] = `VOWCHER#${canonical.parentPassportNo}`;
      values[':passportNo'] = passport.passportNo;
      expression += ', gsi2pk = :vowcherIndex, gsi2sk = :passportNo';
    } else expression += ' REMOVE gsi2pk, gsi2sk';
    await db.send(new UpdateCommand({ TableName: table, Key: { pk: passport.pk, sk: passport.sk }, UpdateExpression: expression, ExpressionAttributeValues: values }));
    migrated += 1;
  } catch (error) {
    unresolved.push({ passportNo: passport.passportNo, error: error.message });
  }
}
const maxPassportNo = passports.reduce((maximum, passport) => Math.max(maximum, Number(passport.passportNo) || 0), 0);
const counter = await db.send(new GetCommand({ TableName: table, Key: { pk: 'SYSTEM', sk: 'PASSPORT_COUNTER' } }));
const safeCounter = Math.max(maxPassportNo, Number(counter.Item?.value || 0));
await db.send(new PutCommand({ TableName: table, Item: { pk: 'SYSTEM', sk: 'MIGRATION#002', type: 'MIGRATION', name: 'canonical-passport-lineage', appliedAt: new Date().toISOString(), migrated, unresolved } }));
await db.send(new UpdateCommand({ TableName: table, Key: { pk: 'SYSTEM', sk: 'PASSPORT_COUNTER' }, UpdateExpression: 'SET #value = :value', ExpressionAttributeNames: { '#value': 'value' }, ExpressionAttributeValues: { ':value': safeCounter } }));
console.log(JSON.stringify({ migrated, unresolved, nextPassportNumberAfter: safeCounter }));
