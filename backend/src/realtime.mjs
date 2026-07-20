import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
let verifier;
const jwtVerifier = () => verifier ||= CognitoJwtVerifier.create({ userPoolId: process.env.USER_POOL_ID, tokenUse: 'access', clientId: process.env.USER_POOL_CLIENT_ID });
const policy = (principalId, effect, resource, context = {}) => ({ principalId, policyDocument: { Version: '2012-10-17', Statement: [{ Action: 'execute-api:Invoke', Effect: effect, Resource: resource }] }, context });

// Delivery is best-effort: stale connections are removed and one failed client never
// prevents notifications to a user's other active devices.
export const broadcastToUser = async (userId, payload) => {
  const endpoint = process.env.WEBSOCKET_MANAGEMENT_ENDPOINT;
  if (!endpoint || !userId) return { delivered: 0, skipped: true };
  const connections = await db.send(new QueryCommand({ TableName: process.env.TABLE_NAME, IndexName: 'gsi4', KeyConditionExpression: 'gsi4pk = :pk', ExpressionAttributeValues: { ':pk': `WSUSER#${userId}` } }));
  const client = new ApiGatewayManagementApiClient({ endpoint }); let delivered = 0;
  await Promise.all((connections.Items || []).map(async (connection) => {
    try { await client.send(new PostToConnectionCommand({ ConnectionId: connection.connectionId, Data: Buffer.from(JSON.stringify(payload)) })); delivered += 1; }
    catch (error) { if (error.$metadata?.httpStatusCode === 410) await db.send(new DeleteCommand({ TableName: process.env.TABLE_NAME, Key: { pk: connection.pk, sk: connection.sk } })); else throw error; }
  }));
  return { delivered };
};

export const authorize = async (event) => {
  const token = String(event.headers?.authorization || event.headers?.Authorization || event.queryStringParameters?.token || '').replace(/^Bearer\s+/i, '');
  if (!token) return policy('anonymous', 'Deny', event.methodArn);
  try { const claims = await jwtVerifier().verify(token); const userId = claims.sub; return policy(userId, 'Allow', event.methodArn, { userId, email: claims.email || '' }); }
  catch { return policy('anonymous', 'Deny', event.methodArn); }
};

export const handler = async (event) => {
  const connectionId = event.requestContext?.connectionId; const route = event.requestContext?.routeKey; const table = process.env.TABLE_NAME;
  if (route === '$connect') { const userId = event.requestContext?.authorizer?.userId || event.requestContext?.authorizer?.principalId; if (!userId) return { statusCode: 401, body: 'Unauthorized' }; const item = { pk: `CONNECTION#${connectionId}`, sk: 'PROFILE', gsi4pk: `WSUSER#${userId}`, gsi4sk: connectionId, type: 'WEBSOCKET_CONNECTION', connectionId, userId, connectedAt: new Date().toISOString(), expiresAt: Math.floor(Date.now() / 1000) + 86400 }; await db.send(new PutCommand({ TableName: table, Item: item })); return { statusCode: 200, body: 'Connected' }; }
  if (route === '$disconnect') { const existing = await db.send(new GetCommand({ TableName: table, Key: { pk: `CONNECTION#${connectionId}`, sk: 'PROFILE' } })); if (existing.Item) await db.send(new DeleteCommand({ TableName: table, Key: { pk: existing.Item.pk, sk: existing.Item.sk } })); return { statusCode: 200, body: 'Disconnected' }; }
  return { statusCode: 200, body: JSON.stringify({ ok: true, type: 'ACK' }) };
};
