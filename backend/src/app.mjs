import { randomUUID, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { createOrder, refundPayment, releaseTransfer, splitTransfer } from './payments.mjs';
import { broadcastToUser } from './realtime.mjs';
import { adminPermissionFor, hasAdminPermission } from './auth/permissions.mjs';
import { adminAuditRecord } from './admin/audit.mjs';
import { sendEmail } from './email.mjs';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const sqs = new SQSClient({});
const ssm = new SSMClient({}); const runtimeConfig = new Map();
const eventBridge = new EventBridgeClient({});
const table = process.env.TABLE_NAME;
const bucket = process.env.UPLOAD_BUCKET;
const json = (statusCode, body, requestId = 'local') => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-request-id': requestId, 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'access-control-allow-origin': process.env.PUBLIC_APP_ORIGIN || 'http://localhost:3000', 'access-control-allow-headers': 'Content-Type,Authorization,Idempotency-Key', 'access-control-allow-credentials': 'true' }, body: JSON.stringify(body) });
const body = (event) => { try { return event.body ? JSON.parse(event.body) : {}; } catch { return null; } };
const claims = (event) => event.requestContext?.authorizer?.jwt?.claims || event.requestContext?.authorizer?.claims || {};
const caller = (event) => claims(event).sub || null;
const isAdmin = (event) => hasAdminPermission(event, 'admin:access');
const id = () => randomUUID();
const now = () => new Date().toISOString();
async function put(item) { await db.send(new PutCommand({ TableName: table, Item: item, ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)' })); return item; }
async function get(pk, sk) { return (await db.send(new GetCommand({ TableName: table, Key: { pk, sk } }))).Item; }
const adminLimit = (value, fallback = 50) => Math.min(Math.max(Number(value || fallback), 1), 100);
async function countByIndex(indexName, key, value) {
  const result = await db.send(new QueryCommand({ TableName: table, IndexName: indexName, KeyConditionExpression: `${key} = :value`, ExpressionAttributeValues: { ':value': value }, Select: 'COUNT' }));
  return result.Count || 0;
}
async function countByType(type, status) {
  const names = { '#type': 'type' }; const values = { ':type': type }; const filters = ['#type = :type'];
  if (status) { names['#status'] = 'status'; values[':status'] = status; filters.push('#status = :status'); }
  const result = await db.send(new ScanCommand({ TableName: table, Select: 'COUNT', FilterExpression: filters.join(' AND '), ExpressionAttributeNames: names, ExpressionAttributeValues: values }));
  return result.Count || 0;
}
async function adminScan({ type, status, cursor, limit, extraFilter, extraValues = {}, extraNames = {} }) {
  const names = { '#type': 'type', ...extraNames }; const values = { ':type': type, ...extraValues }; const filters = ['#type = :type'];
  if (status) { names['#status'] = 'status'; values[':status'] = status; filters.push('#status = :status'); }
  if (extraFilter) filters.push(extraFilter);
  const result = await db.send(new ScanCommand({ TableName: table, FilterExpression: filters.join(' AND '), ExpressionAttributeNames: names, ExpressionAttributeValues: values, ExclusiveStartKey: cursor, Limit: limit }));
  return { items: result.Items || [], nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url') : null };
}
async function passportByNumber(passportNo) {
  if (!passportNo) return null;
  const result = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi1', KeyConditionExpression: 'gsi1pk = :pk', ExpressionAttributeValues: { ':pk': `PASSPORT_NO#${passportNo}` }, Limit: 1 }));
  return result.Items?.[0] || null;
}
async function activePassportForUser(userId) {
  const result = await db.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)', ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'PASSPORT#' } }));
  return (result.Items || []).filter((item) => item.type === 'PASSPORT' && item.status === 'ACTIVE').sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)))[0] || null;
}
async function houseTree(rootPassport, { maxDepth = 12, maxNodes = 250 } = {}) {
  const nodes = [{ ...rootPassport, depth: 0 }]; const edges = []; const queue = [{ passport: rootPassport, depth: 0 }]; let truncated = false;
  while (queue.length) {
    const { passport, depth } = queue.shift();
    if (depth >= maxDepth) { if (passport.gsi2pk) truncated = true; continue; }
    let lastKey;
    do {
      const page = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi2', KeyConditionExpression: 'gsi2pk = :pk', ExpressionAttributeValues: { ':pk': `VOWCHER#${passport.passportNo}` }, ExclusiveStartKey: lastKey, Limit: Math.min(50, maxNodes - nodes.length) }));
      for (const child of page.Items || []) {
        if (nodes.length >= maxNodes) { truncated = true; break; }
        nodes.push({ ...child, depth: depth + 1 }); edges.push({ from: passport.passportNo, to: child.passportNo }); queue.push({ passport: child, depth: depth + 1 });
      }
      lastKey = nodes.length >= maxNodes ? undefined : page.LastEvaluatedKey;
    } while (lastKey);
    if (nodes.length >= maxNodes) { truncated = true; break; }
  }
  return { nodes, edges, truncated, maxDepth, maxNodes };
}
const treeNode = (passport) => ({ passportNo: passport.passportNo, parentPassportNo: passport.vowchedBy || null, userId: passport.userId, primarySkill: passport.primarySkill || 'general', cred: Number(passport.cred || 0), status: passport.status, generation: Number(passport.generation || 0), depth: passport.depth || 0 });
const pageKey = (token) => { if (!token) return undefined; try { return JSON.parse(Buffer.from(token, 'base64url').toString('utf8')); } catch { return null; } };
const responseError = (code, message) => json(code, { error: message });
async function rateLimit(key, limit, windowSeconds = 60) {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000)); const pk = `RATE#${key}#${bucket}`;
  const result = await db.send(new UpdateCommand({ TableName: table, Key: { pk, sk: 'COUNT' }, UpdateExpression: 'ADD #count :one SET expiresAt = if_not_exists(expiresAt, :expires)', ExpressionAttributeNames: { '#count': 'count' }, ExpressionAttributeValues: { ':one': 1, ':expires': Math.floor(Date.now() / 1000) + windowSeconds + 60 }, ReturnValues: 'UPDATED_NEW' }));
  return Number(result.Attributes?.count || 1) <= limit;
}
async function notifyEmail(recipientId, message) {
  const profile = await get(`USER#${recipientId}`, 'PROFILE'); const email = profile?.email;
  if (!email || profile?.notificationPreferences?.email === false) return;
  try { await sendEmail({ to: email, subject: 'Vowch update', text: message }); }
  catch (error) { await put({ pk: `NOTIFICATION_RETRY#${recipientId}`, sk: `${Date.now()}#${id()}`, type: 'NOTIFICATION_DELIVERY_FAILURE', channel: 'EMAIL', recipientId, message: String(message).slice(0, 500), error: String(error.message || error).slice(0, 1000), retryAfter: new Date(Date.now() + 15 * 60 * 1000).toISOString(), createdAt: now() }); }
}
async function enqueueNotification(recipientId, { notificationType = 'UPDATE', title = 'Vowch update', message, data = {} }) {
  const notificationId = id(); const createdAt = now();
  const notification = { pk: `USER#${recipientId}`, sk: `NOTIFICATION#${Date.now()}#${notificationId}`, type: 'NOTIFICATION', notificationId, notificationType, title, message: String(message).slice(0, 500), ...data, read: false, createdAt };
  await put(notification);
  await put({ pk: `NOTIFICATION_OUTBOX#${notificationId}`, sk: 'PROFILE', gsi2pk: 'OUTBOX#PENDING', gsi2sk: `${createdAt}#${notificationId}`, type: 'NOTIFICATION_OUTBOX', notificationId, recipientId, title: notification.title, message: notification.message, data, channels: ['EMAIL', 'PUSH', 'WEBSOCKET'], status: 'PENDING', attempts: 0, availableAt: createdAt, createdAt });
  return notification;
}
async function paymentLedger(orderId, event, details = {}) {
  return put({ pk: `PAYMENT_LEDGER#${orderId}`, sk: `${Date.now()}#${id()}`, type: 'PAYMENT_LEDGER_EVENT', orderId, event, ...details, createdAt: now() });
}
const paymentIndex = (payment, status, at = now()) => ({ gsi2pk: `PAYMENT_STATUS#${status}`, gsi2sk: `${status === 'CAPTURED' && payment.reviewWindowEndsAt ? payment.reviewWindowEndsAt : at}#${payment.orderId}`, gsi3pk: `PAYMENT_GIG#${payment.gigId}`, gsi3sk: `${status}#${at}#${payment.orderId}` });
async function paymentsForGig(gigId, status = null) {
  const result = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi3', KeyConditionExpression: status ? 'gsi3pk = :pk AND begins_with(gsi3sk, :status)' : 'gsi3pk = :pk', ExpressionAttributeValues: status ? { ':pk': `PAYMENT_GIG#${gigId}`, ':status': `${status}#` } : { ':pk': `PAYMENT_GIG#${gigId}` } }));
  return result.Items || [];
}
async function bindEscrowToDoer(gigId, doerId) {
  const worker = await get(`USER#${doerId}`, 'PROFILE'); if (!worker?.razorpayAccountId) throw new Error('WORKER_PAYOUT_ACCOUNT_REQUIRED');
  const payments = await paymentsForGig(gigId, 'CAPTURED'); const at = now();
  for (const payment of payments) { const rate = Number(worker.cred || 500) >= 800 ? 1000 : Number(worker.cred || 500) >= 650 ? 1200 : 1500; const commissionPaise = Math.round(Number(payment.amountPaise) * rate / 10000); await db.send(new PutCommand({ TableName: table, Item: { ...payment, doerId, razorpayAccountId: worker.razorpayAccountId, commissionRateBps: rate, commissionPaise, payoutPaise: Number(payment.amountPaise) - commissionPaise, escrowBoundAt: at, updatedAt: at } })); }
}
async function startReviewWindow(gigId) {
  const at = now(); const reviewWindowEndsAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); const payments = await paymentsForGig(gigId, 'CAPTURED');
  for (const payment of payments) await db.send(new PutCommand({ TableName: table, Item: { ...payment, ...paymentIndex({ ...payment, reviewWindowEndsAt }, 'CAPTURED', at), reviewWindowEndsAt, updatedAt: at } }));
  return reviewWindowEndsAt;
}
async function recordPaymentRetry(payment, operation, error) {
  const retry = { pk: `PAYMENT_RETRY#${payment.orderId}`, sk: `${Date.now()}#${id()}`, type: 'PAYMENT_RETRY', orderId: payment.orderId, operation, attempts: Number(payment.providerRetryCount || 0) + 1, error: String(error.message || error).slice(0, 1000), retryAfter: new Date(Date.now() + 15 * 60 * 1000).toISOString(), createdAt: now() };
  await put(retry); await paymentLedger(payment.orderId, `${operation}_FAILED`, { error: retry.error, retryAfter: retry.retryAfter });
  return retry;
}
async function settlePayment(payment, operation, actorId, transfers = null) {
  const targetStatus = operation === 'REFUND' ? 'REFUND_IN_PROGRESS' : operation === 'SPLIT' ? 'SPLIT_IN_PROGRESS' : 'RELEASE_IN_PROGRESS';
  const allowed = operation === 'REFUND' ? ['CAPTURED', 'READY_FOR_RELEASE', 'REFUND_RETRY_REQUIRED'] : ['CAPTURED', 'READY_FOR_RELEASE', 'RELEASE_RETRY_REQUIRED'];
  try {
    const startedAt = now(); await db.send(new UpdateCommand({ TableName: table, Key: { pk: payment.pk, sk: payment.sk }, UpdateExpression: 'SET #status = :target, gsi2pk = :gsi2pk, gsi2sk = :gsi2sk, gsi3pk = :gsi3pk, gsi3sk = :gsi3sk, settlementOperation = :operation, settlementStartedAt = :at', ConditionExpression: '#status IN (' + allowed.map((_, index) => `:allowed${index}`).join(', ') + ')', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':target': targetStatus, ...Object.fromEntries(Object.entries(paymentIndex(payment, targetStatus, startedAt)).map(([key, value]) => [`:${key}`, value])), ':operation': operation, ':at': startedAt, ...Object.fromEntries(allowed.map((status, index) => [`:allowed${index}`, status])) } }));
  } catch (error) { if (error.name === 'ConditionalCheckFailedException') throw new Error('PAYMENT_NOT_ACTIONABLE'); throw error; }
  const idempotencyKey = `${operation.toLowerCase()}-${payment.orderId}`;
  try {
    let providerResult;
    if (operation === 'REFUND') providerResult = await refundPayment(payment.providerPaymentId, payment.amountPaise, { gigId: payment.gigId, orderId: payment.orderId }, idempotencyKey);
    else if (operation === 'SPLIT') providerResult = await splitTransfer(payment.providerPaymentId, transfers, idempotencyKey);
    else providerResult = await releaseTransfer(payment.providerPaymentId, payment.razorpayAccountId, payment.payoutPaise || payment.amountPaise, { gigId: payment.gigId, orderId: payment.orderId }, idempotencyKey);
    const status = operation === 'REFUND' ? 'REFUNDED' : 'RELEASED'; const settledAt = now(); const updated = { ...payment, ...paymentIndex(payment, status, settledAt), status, settlementOperation: operation, settlementCompletedAt: settledAt, settledBy: actorId, providerResult, providerRetryCount: Number(payment.providerRetryCount || 0), ...(status === 'RELEASED' && payment.doerId ? { gsi4pk: `EARNINGS#${payment.doerId}`, gsi4sk: settledAt } : {}) };
    await db.send(new PutCommand({ TableName: table, Item: updated })); await paymentLedger(payment.orderId, status, { actorId, operation, providerResult });
    return updated;
  } catch (error) {
    const retryStatus = operation === 'REFUND' ? 'REFUND_RETRY_REQUIRED' : 'RELEASE_RETRY_REQUIRED';
    const retryAt = now(); await db.send(new UpdateCommand({ TableName: table, Key: { pk: payment.pk, sk: payment.sk }, UpdateExpression: 'SET #status = :status, gsi2pk = :gsi2pk, gsi2sk = :gsi2sk, gsi3pk = :gsi3pk, gsi3sk = :gsi3sk, providerRetryCount = if_not_exists(providerRetryCount, :zero) + :one, lastProviderError = :error, updatedAt = :at', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':status': retryStatus, ...Object.fromEntries(Object.entries(paymentIndex(payment, retryStatus, retryAt)).map(([key, value]) => [`:${key}`, value])), ':zero': 0, ':one': 1, ':error': String(error.message || error).slice(0, 1000), ':at': retryAt } }));
    await recordPaymentRetry(payment, operation, error); throw error;
  }
}
async function applyCred(userId, delta, reason, metadata = {}) {
  const profile = await get(`USER#${userId}`, 'PROFILE'); if (!profile) return null;
  const nextCred = Math.max(0, Math.min(1000, Number(profile.cred ?? 500) + delta)); const appliedDelta = nextCred - Number(profile.cred ?? 500);
  await db.send(new PutCommand({ TableName: table, Item: { ...profile, cred: nextCred, updatedAt: now() } }));
  await put({ pk: `USER#${userId}`, sk: `CRED_EVENT#${Date.now()}#${id()}`, type: 'CRED_EVENT', userId, delta: appliedDelta, reason, balanceAfter: nextCred, ...metadata, createdAt: now() });
  return { cred: nextCred, delta: appliedDelta };
}
async function applyConfirmedVowchPenalty(subjectPassportNo, caseId) {
  const subject = await passportByNumber(subjectPassportNo); const parent = await passportByNumber(subject?.vowchedBy); const grandparent = await passportByNumber(parent?.vowchedBy); const events = [];
  if (parent?.userId) events.push({ passportNo: parent.passportNo, userId: parent.userId, result: await applyCred(parent.userId, -5, 'CONFIRMED_VOWCH_MISCONDUCT', { caseId, subjectPassportNo }) });
  if (grandparent?.userId) events.push({ passportNo: grandparent.passportNo, userId: grandparent.userId, result: await applyCred(grandparent.userId, -2, 'CONFIRMED_DESCENDANT_MISCONDUCT', { caseId, subjectPassportNo }) });
  return events;
}
async function emitEvent(detailType, detail) { if (!process.env.EVENT_BUS_NAME) return; try { await eventBridge.send(new PutEventsCommand({ Entries: [{ EventBusName: process.env.EVENT_BUS_NAME, Source: 'vowch.api', DetailType: detailType, Detail: JSON.stringify({ ...detail, occurredAt: now() }) }] })); } catch (error) { console.warn(JSON.stringify({ event: 'EVENT_PUBLISH_FAILED', detailType, error: error.message })); } }
async function broadcastEvent(recipientId, type, data) { try { await broadcastToUser(recipientId, { type, data, occurredAt: now() }); } catch (error) { console.warn(JSON.stringify({ event: 'WEBSOCKET_BROADCAST_FAILED', recipientId, type, error: error.message })); } }
async function runtimeSecret(name, fallback = '') { if (runtimeConfig.has(name)) return runtimeConfig.get(name); const parameterName = `${process.env.SSM_PREFIX || ''}/${name}`; try { const result = await ssm.send(new GetParameterCommand({ Name: parameterName, WithDecryption: true })); const value = result.Parameter?.Value || fallback; runtimeConfig.set(name, value); return value; } catch { return fallback; } }
const validSignature = async (event) => {
  const secret = await runtimeSecret('payments/webhook-secret', process.env.PAYMENT_WEBHOOK_SECRET);
  if (!secret) return false;
  const supplied = event.headers?.['x-razorpay-signature'] || event.headers?.['X-Razorpay-Signature'] || '';
  const expected = createHmac('sha256', secret).update(event.body || '').digest('hex');
  return supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
};

export const handler = async (event) => {
  const requestId = event.requestContext?.requestId || id(); console.log(JSON.stringify({ requestId, path: event.rawPath, method: event.requestContext?.http?.method, at: now() }));
  const rawPath = event.rawPath || '/'; const stage = event.requestContext?.stage;
  const path = stage && rawPath.startsWith(`/${stage}/`) ? rawPath.slice(stage.length + 1) : rawPath;
  const method = event.requestContext?.http?.method || 'GET';
  if (method === 'OPTIONS') return json(204, {});
  if (path === '/health') return json(200, { ok: true, service: 'vowch-api', environment: process.env.ENVIRONMENT || 'dev' });
  const adminPermission = adminPermissionFor(path, method);
  if (adminPermission && !hasAdminPermission(event, adminPermission)) return responseError(403, 'ADMIN_PERMISSION_REQUIRED');
  const input = body(event); if (input === null) return responseError(400, 'INVALID_JSON');

  if (path === '/v1/admin/dashboard/summary' && method === 'GET') {
    const [identityPending, skillPending, trustOpen, proofPending, disputes, paymentRetries, notificationFailures] = await Promise.all([
      countByIndex('gsi1', 'gsi1pk', 'IDENTITY_REVIEWS#PENDING'), countByIndex('gsi1', 'gsi1pk', 'SKILL_REVIEWS#PENDING'), countByType('TRUST_CASE', 'OPEN'), countByType('PROOF_JOB', 'HUMAN_REVIEW'), countByIndex('gsi1', 'gsi1pk', 'GIGS#DISPUTED'), countByIndex('gsi2', 'gsi2pk', 'PAYMENT_STATUS#RELEASE_RETRY_REQUIRED').then(async (release) => release + await countByIndex('gsi2', 'gsi2pk', 'PAYMENT_STATUS#REFUND_RETRY_REQUIRED')), countByType('NOTIFICATION_DELIVERY_FAILURE')
    ]);
    return json(200, { generatedAt: now(), queues: { identityPending, skillPending, trustOpen, proofPending, disputes, paymentRetries, notificationFailures } }, requestId);
  }
  if (path === '/v1/admin/dashboard/activity' && method === 'GET') {
    const cursor = pageKey(event.queryStringParameters?.nextToken); if (cursor === null) return responseError(400, 'INVALID_PAGE_TOKEN');
    const result = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi4', KeyConditionExpression: 'gsi4pk = :pk', ExpressionAttributeValues: { ':pk': 'AUDIT#ALL' }, ScanIndexForward: false, ExclusiveStartKey: cursor, Limit: adminLimit(event.queryStringParameters?.limit, 30) }));
    return json(200, { items: result.Items || [], nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url') : null }, requestId);
  }
  if (path === '/v1/admin/users' && method === 'GET') {
    const cursor = pageKey(event.queryStringParameters?.nextToken); if (cursor === null) return responseError(400, 'INVALID_PAGE_TOKEN'); const query = String(event.queryStringParameters?.query || '').trim(); const accountStatus = String(event.queryStringParameters?.status || '').trim();
    const filters = [query ? '(contains(displayName, :query) OR contains(userId, :query))' : '', accountStatus ? 'accountStatus = :accountStatus' : ''].filter(Boolean);
    const result = await adminScan({ type: 'USER', cursor, limit: adminLimit(event.queryStringParameters?.limit), extraFilter: filters.join(' AND ') || undefined, extraValues: { ...(query ? { ':query': query } : {}), ...(accountStatus ? { ':accountStatus': accountStatus } : {}) } });
    return json(200, result, requestId);
  }
  const adminUser = path.match(/^\/v1\/admin\/users\/([^/]+)$/);
  if (adminUser && method === 'GET') { const profile = await get(`USER#${adminUser[1]}`, 'PROFILE'); if (!profile) return responseError(404, 'USER_NOT_FOUND'); const related = await db.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': `USER#${adminUser[1]}` }, Limit: 100 })); return json(200, { profile, related: related.Items || [] }, requestId); }
  if (path === '/v1/admin/gigs' && method === 'GET') {
    const cursor = pageKey(event.queryStringParameters?.nextToken); if (cursor === null) return responseError(400, 'INVALID_PAGE_TOKEN'); const result = await adminScan({ type: 'GIG', status: event.queryStringParameters?.status, cursor, limit: adminLimit(event.queryStringParameters?.limit) }); return json(200, result, requestId);
  }
  const adminGig = path.match(/^\/v1\/admin\/gigs\/([^/]+)$/);
  if (adminGig && method === 'GET') { const gig = await get(`GIG#${adminGig[1]}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND'); const details = await db.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': `GIG#${gig.gigId}` }, Limit: 100 })); const payments = await adminScan({ type: 'ESCROW_ORDER', limit: 100, extraFilter: 'gigId = :gigId', extraValues: { ':gigId': gig.gigId } }); return json(200, { gig, timeline: details.Items || [], payments: payments.items }, requestId); }
  if (path === '/v1/admin/payments' && method === 'GET') {
    const cursor = pageKey(event.queryStringParameters?.nextToken); if (cursor === null) return responseError(400, 'INVALID_PAGE_TOKEN'); const result = await adminScan({ type: 'ESCROW_ORDER', status: event.queryStringParameters?.status, cursor, limit: adminLimit(event.queryStringParameters?.limit) }); return json(200, result, requestId);
  }
  const adminPayment = path.match(/^\/v1\/admin\/payments\/([^/]+)$/);
  if (adminPayment && method === 'GET') { const payment = await get(`PAYMENT#${adminPayment[1]}`, 'PROFILE'); if (!payment) return responseError(404, 'PAYMENT_NOT_FOUND'); const ledger = await db.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': `PAYMENT_LEDGER#${payment.orderId}` }, ScanIndexForward: false })); return json(200, { payment, ledger: ledger.Items || [] }, requestId); }

  if (path === '/v1/public/requests' && method === 'POST') {
    if (!input.title || !input.description || !Number.isInteger(input.budgetPaise) || input.budgetPaise < 100) return responseError(400, 'title, description and budgetPaise are required');
    if (!(await rateLimit(`public:${event.requestContext?.http?.sourceIp || 'unknown'}`, 10, 3600))) return responseError(429, 'RATE_LIMITED');
    const request = { pk: `REQUEST#${id()}`, sk: 'PROFILE', type: 'PUBLIC_REQUEST', title: input.title, description: input.description, budgetPaise: input.budgetPaise, skill: input.skill || 'general', status: 'SUBMITTED', createdAt: now() };
    return json(201, await put(request));
  }
  if (path === '/v1/payments/webhook' && method === 'POST') {
    if (!(await validSignature(event))) return responseError(401, 'INVALID_WEBHOOK_SIGNATURE');
    const eventId = event.headers?.['x-event-id'] || createHash('sha256').update(event.body || '').digest('hex');
    const existing = await get(`EVENT#${eventId}`, 'PROFILE'); if (existing) return json(200, { ok: true, duplicate: true });
    let payload = {}; try { payload = JSON.parse(event.body || '{}'); } catch { return responseError(400, 'INVALID_WEBHOOK_JSON'); }
    const eventName = payload.event || ''; const entity = payload.payload?.payment?.entity || payload.payload?.order?.entity || {}; const orderId = entity.order_id || entity.id;
    if (orderId) { const payment = await get(`PAYMENT#${orderId}`, 'PROFILE'); if (payment) { const status = eventName.includes('captured') ? 'CAPTURED' : eventName.includes('failed') ? 'PAYMENT_FAILED' : eventName.includes('refunded') ? 'REFUNDED' : payment.status; const updatedAt = now(); await db.send(new PutCommand({ TableName: table, Item: { ...payment, ...paymentIndex(payment, status, updatedAt), status, providerPaymentId: entity.id || payment.providerPaymentId, lastWebhookEvent: eventName, updatedAt } })); if (status === 'CAPTURED') { const gig = await get(`GIG#${payment.gigId}`, 'PROFILE'); if (gig?.status === 'DRAFT') await db.send(new PutCommand({ TableName: table, Item: { ...gig, status: 'OPEN', gsi1pk: 'GIGS#OPEN', gsi1sk: updatedAt, gsi2pk: 'GIG_EXPIRY#OPEN', gsi2sk: `${gig.deadlineAt}#${gig.gigId}`, escrowOrderId: payment.orderId, escrowStatus: 'CAPTURED', openedAt: updatedAt, updatedAt }, ConditionExpression: '#status = :draft', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':draft': 'DRAFT' } })); } } }
    await put({ pk: `EVENT#${eventId}`, sk: 'PROFILE', type: 'PAYMENT_EVENT', eventId, eventName, receivedAt: now(), payload });
    if (orderId) await put({ pk: `PAYMENT_LEDGER#${orderId}`, sk: `${Date.now()}#${eventId}`, type: 'PAYMENT_LEDGER_EVENT', orderId, eventId, eventName, createdAt: now() });
    return json(200, { ok: true });
  }
  if (path === '/v1/invites/preview' && method === 'GET') {
    const code = event.queryStringParameters?.code;
    if (!code) return responseError(400, 'code is required');
    const found = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi1', KeyConditionExpression: 'gsi1pk = :pk', ExpressionAttributeValues: { ':pk': `INVITE_CODE#${code}` }, Limit: 1 }));
    const invite = found.Items?.[0];
    if (!invite || invite.status !== 'ISSUED') return responseError(404, 'INVITE_INVALID_OR_REDEEMED');
    return json(200, { valid: true, code, stake: invite.stakePreview, expiresAt: invite.expiresAt || null });
  }
  if (path === '/v1/waitlist' && method === 'POST') {
    const email = String(input.email || '').trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(email)) return responseError(400, 'valid email is required'); if (!(await rateLimit(`waitlist:${event.requestContext?.http?.sourceIp || 'unknown'}`, 5, 86400))) return responseError(429, 'RATE_LIMITED');
    const counter = await db.send(new UpdateCommand({ TableName: table, Key: { pk: 'SYSTEM', sk: 'WAITLIST_COUNTER' }, UpdateExpression: 'ADD #value :one', ExpressionAttributeNames: { '#value': 'value' }, ExpressionAttributeValues: { ':one': 1 }, ReturnValues: 'UPDATED_NEW' })); const waitlistId = id(); const item = { pk: `WAITLIST#${waitlistId}`, sk: 'PROFILE', gsi1pk: 'WAITLIST#ALL', gsi1sk: String(counter.Attributes.value).padStart(10, '0'), type: 'WAITLIST_ENTRY', waitlistId, email, skill: String(input.skill || 'general').slice(0, 80), source: String(input.source || 'organic').slice(0, 80), position: Number(counter.Attributes.value), status: 'WAITING', createdAt: now() };
    await put(item); return json(201, { waitlistId, position: item.position, status: item.status });
  }

  const userId = caller(event); if (!userId) return responseError(401, 'UNAUTHENTICATED');
  if (path === '/v1/onboarding/complete' && method === 'POST') {
    if (!input.displayName || !input.primarySkill || !input.inviteCode) return responseError(400, 'displayName, primarySkill and inviteCode are required');
    const existing = await get(`USER#${userId}`, 'PROFILE');
    if (existing?.onboardingComplete) return json(200, { user: existing, alreadyComplete: true });
    if (existing?.identityStatus === 'PENDING_MANUAL_REVIEW') return json(202, { status: 'PENDING_MANUAL_REVIEW', reviewId: existing.identityReviewId, message: 'Your identity is awaiting admin verification.' });
    const found = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi1', KeyConditionExpression: 'gsi1pk = :pk', ExpressionAttributeValues: { ':pk': `INVITE_CODE#${input.inviteCode}` } }));
    const invite = found.Items?.[0]; if (!invite || invite.status !== 'ISSUED') return responseError(404, 'INVITE_INVALID_OR_REDEEMED');
    const reviewId = id(); const user = { pk: `USER#${userId}`, sk: 'PROFILE', type: 'USER', userId, email: claims(event).email || existing?.email || null, displayName: input.displayName, primarySkill: input.primarySkill, cred: 500, inviteCapacity: 3, invitesIssued: 0, onboardingComplete: false, identityStatus: 'PENDING_MANUAL_REVIEW', identityReviewId: reviewId, pendingInviteCode: input.inviteCode, identityEvidence: { reference: String(input.identityReference || '').slice(0, 100), notes: String(input.identityNotes || '').slice(0, 1000) }, createdAt: existing?.createdAt || now(), updatedAt: now() };
    const review = { pk: `IDENTITY_REVIEW#${reviewId}`, sk: 'PROFILE', gsi1pk: 'IDENTITY_REVIEWS#PENDING', gsi1sk: `${now()}#${reviewId}`, type: 'IDENTITY_REVIEW', reviewId, userId, inviteCode: input.inviteCode, status: 'PENDING', displayName: user.displayName, primarySkill: user.primarySkill, evidence: user.identityEvidence, createdAt: now() };
    try {
      await db.send(new TransactWriteCommand({ TransactItems: [
        { Put: { TableName: table, Item: user, ConditionExpression: 'attribute_not_exists(onboardingComplete)' } },
        { Put: { TableName: table, Item: review, ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)' } }
      ] }));
    } catch (error) {
      return responseError(error.name === 'TransactionCanceledException' ? 409 : 500, error.name === 'TransactionCanceledException' ? 'ONBOARDING_CONFLICT' : 'ONBOARDING_FAILED');
    }
    return json(202, { status: user.identityStatus, reviewId, message: 'Identity submitted for manual admin verification.' });
  }
  if (path === '/v1/me' && method === 'GET') {
    const profile = await get(`USER#${userId}`, 'PROFILE') || { userId };
    if (profile.avatar?.kind === 'upload' && String(profile.avatar.key).startsWith(`members/${userId}/`)) {
      profile.avatarUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: profile.avatar.key }), { expiresIn: 600 });
    }
    return json(200, profile);
  }
  if (path === '/v1/me' && method === 'PUT') {
    const existing = await get(`USER#${userId}`, 'PROFILE');
    const displayName = String(input.displayName || existing?.displayName || '').trim().slice(0, 120);
    const primarySkill = String(input.primarySkill || existing?.primarySkill || '').trim().slice(0, 100) || null;
    const location = String(input.location || existing?.location || '').trim().slice(0, 180) || null;
    const candidateAvatar = input.avatar;
    const avatar = candidateAvatar?.kind === 'default' && typeof candidateAvatar.id === 'string'
      ? { kind: 'default', id: candidateAvatar.id.slice(0, 40) }
      : candidateAvatar?.kind === 'upload' && typeof candidateAvatar.key === 'string' && candidateAvatar.key.startsWith(`members/${userId}/`)
        ? { kind: 'upload', key: candidateAvatar.key, contentType: String(candidateAvatar.contentType || 'image/jpeg').slice(0, 100), status: 'PENDING_SCAN' }
        : existing?.avatar || { kind: 'default', id: 'coral' };
    const item = { ...existing, pk: `USER#${userId}`, sk: 'PROFILE', type: 'USER', userId, displayName, primarySkill, location, avatar, updatedAt: now(), createdAt: existing?.createdAt || now() };
    await db.send(new PutCommand({ TableName: table, Item: item })); return json(200, item);
  }
  if (path === '/v1/notifications' && method === 'GET') {
    const cursor = pageKey(event.queryStringParameters?.nextToken); if (cursor === null) return responseError(400, 'INVALID_PAGE_TOKEN');
    const result = await db.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)', ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'NOTIFICATION#' }, ExclusiveStartKey: cursor, ScanIndexForward: false, Limit: Math.min(Number(event.queryStringParameters?.limit || 50), 100) }));
    return json(200, { items: result.Items || [], nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url') : null });
  }
  if (path === '/v1/notification-preferences' && method === 'GET') {
    const profile = await get(`USER#${userId}`, 'PROFILE'); return json(200, profile?.notificationPreferences || { inApp: true, email: true, push: true, marketing: false });
  }
  if (path === '/v1/notification-preferences' && method === 'PUT') {
    const profile = await get(`USER#${userId}`, 'PROFILE') || { pk: `USER#${userId}`, sk: 'PROFILE', type: 'USER', userId, createdAt: now() };
    const current = profile.notificationPreferences || { inApp: true, email: true, push: true, marketing: false }; const preferences = { inApp: input.inApp !== false, email: input.email !== false, push: input.push !== false, marketing: input.marketing === true };
    const updated = { ...profile, notificationPreferences: { ...current, ...preferences }, notificationPreferencesUpdatedAt: now(), updatedAt: now() }; await db.send(new PutCommand({ TableName: table, Item: updated })); return json(200, updated.notificationPreferences);
  }
  if (path === '/v1/push/devices' && method === 'POST') {
    const token = String(input.token || '').trim(); const platform = String(input.platform || '').toUpperCase(); if (token.length < 20 || !['IOS', 'ANDROID'].includes(platform)) return responseError(400, 'valid IOS or ANDROID device token is required');
    const tokenHash = createHash('sha256').update(token).digest('hex'); const device = { pk: `USER#${userId}`, sk: `PUSH_DEVICE#${tokenHash}`, type: 'PUSH_DEVICE', token, tokenHash, platform, enabled: true, createdAt: now(), updatedAt: now() };
    await db.send(new PutCommand({ TableName: table, Item: device })); return json(201, { tokenHash, platform, enabled: true });
  }
  const pushDevice = path.match(/^\/v1\/push\/devices\/([a-f0-9]{64})$/);
  if (pushDevice && method === 'DELETE') { try { await db.send(new UpdateCommand({ TableName: table, Key: { pk: `USER#${userId}`, sk: `PUSH_DEVICE#${pushDevice[1]}` }, UpdateExpression: 'SET enabled = :false, disabledAt = :at', ConditionExpression: 'attribute_exists(pk)', ExpressionAttributeValues: { ':false': false, ':at': now() } })); } catch (error) { if (error.name === 'ConditionalCheckFailedException') return responseError(404, 'PUSH_DEVICE_NOT_FOUND'); throw error; } return json(204, {}); }
  const notificationMatch = path.match(/^\/v1\/notifications\/([^/]+)\/read$/);
  if (notificationMatch && method === 'PATCH') {
    const notification = await get(`USER#${userId}`, `NOTIFICATION#${notificationMatch[1]}`);
    if (!notification) return responseError(404, 'NOTIFICATION_NOT_FOUND');
    const updated = { ...notification, read: true, readAt: now() };
    await db.send(new PutCommand({ TableName: table, Item: updated })); return json(200, updated);
  }
  if (path === '/v1/passports' && method === 'GET') return json(200, (await db.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': `USER#${userId}` } }))).Items?.filter((x) => x.type === 'PASSPORT') || []);
  if (path === '/v1/me/skills' && method === 'GET') return json(200, (await db.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)', ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'SKILL#' } }))).Items || []);
  const portfolioPath = path.match(/^\/v1\/skills\/([^/]+)\/portfolio$/);
  if (portfolioPath && method === 'POST') { const skill = portfolioPath[1]; if (!Array.isArray(input.files) || input.files.length < 1 || input.files.length > 5) return responseError(400, 'files must contain 1-5 portfolio uploads'); const reviewId = id(); const review = { pk: `SKILL_REVIEW#${reviewId}`, sk: 'PROFILE', gsi1pk: 'SKILL_REVIEWS#PENDING', gsi1sk: `${now()}#${reviewId}`, type: 'SKILL_REVIEW', reviewId, userId, skill, files: input.files, status: 'PENDING', createdAt: now() }; await put(review); return json(202, { reviewId, status: review.status }); }
  const quizPath = path.match(/^\/v1\/skills\/([^/]+)\/quiz$/);
  if (quizPath && method === 'POST') { const skill = quizPath[1]; const quizId = id(); const quiz = { pk: `QUIZ#${quizId}`, sk: 'PROFILE', type: 'SKILL_QUIZ', quizId, userId, skill, status: 'PENDING_REVIEW', answers: input.answers || [], createdAt: now() }; await put(quiz); await put({ pk: `SKILL_REVIEW#${quizId}`, sk: 'PROFILE', gsi1pk: 'SKILL_REVIEWS#PENDING', gsi1sk: `${now()}#${quizId}`, type: 'SKILL_REVIEW', reviewId: quizId, userId, skill, source: 'QUIZ', quizId, status: 'PENDING', createdAt: now() }); return json(202, { quizId, status: quiz.status }); }
  if (path === '/v1/leaderboards/skills' && method === 'GET') {
    const skill = String(event.queryStringParameters?.skill || '').trim(); if (!skill) return responseError(400, 'skill is required'); const result = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi3', KeyConditionExpression: 'gsi3pk = :pk', ExpressionAttributeValues: { ':pk': `SKILL#${skill}` }, ScanIndexForward: false, Limit: Math.min(Number(event.queryStringParameters?.limit || 25), 100) })); return json(200, { skill, items: (result.Items || []).filter((item) => item.status === 'ACTIVE').map(treeNode) });
  }
  if (path === '/v1/communities' && method === 'GET') return json(200, (await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi1', KeyConditionExpression: 'gsi1pk = :pk', ExpressionAttributeValues: { ':pk': 'COMMUNITIES' } }))).Items || []);
  if (path === '/v1/communities' && method === 'POST') { if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED'); if (!input.name || !input.skill) return responseError(400, 'name and skill are required'); const communityId = id(); const item = { pk: `COMMUNITY#${communityId}`, sk: 'PROFILE', gsi1pk: 'COMMUNITIES', gsi1sk: now(), type: 'COMMUNITY', communityId, name: input.name, skill: input.skill, status: 'ACTIVE', createdBy: userId, createdAt: now() }; return json(201, await put(item)); }
  const joinCommunity = path.match(/^\/v1\/communities\/([^/]+)\/join$/);
  if (joinCommunity && method === 'POST') { const community = await get(`COMMUNITY#${joinCommunity[1]}`, 'PROFILE'); if (!community || community.status !== 'ACTIVE') return responseError(404, 'COMMUNITY_NOT_FOUND'); const passport = await activePassportForUser(userId); if (!passport) return responseError(409, 'ACTIVE_PASSPORT_REQUIRED'); const membership = { pk: `USER#${userId}`, sk: `COMMUNITY#${community.communityId}`, type: 'COMMUNITY_MEMBERSHIP', communityId: community.communityId, userId, role: 'MEMBER', joinedAt: now() }; try { await put(membership); } catch (error) { if (error.name === 'ConditionalCheckFailedException') return responseError(409, 'ALREADY_JOINED'); throw error; } return json(201, membership); }
  const communityRole = path.match(/^\/v1\/communities\/([^/]+)\/members\/([^/]+)\/role$/);
  if (communityRole && method === 'PATCH') {
    const [communityId, memberId] = [communityRole[1], communityRole[2]]; const community = await get(`COMMUNITY#${communityId}`, 'PROFILE'); if (!community) return responseError(404, 'COMMUNITY_NOT_FOUND');
    const actorMembership = await get(`USER#${userId}`, `COMMUNITY#${communityId}`); const permitted = isAdmin(event) || community.createdBy === userId || ['OWNER', 'MODERATOR'].includes(actorMembership?.role);
    if (!permitted) return responseError(403, 'COMMUNITY_ROLE_FORBIDDEN'); const role = String(input.role || '').toUpperCase(); if (!['MEMBER', 'MODERATOR'].includes(role)) return responseError(400, 'role must be MEMBER or MODERATOR');
    const membership = await get(`USER#${memberId}`, `COMMUNITY#${communityId}`); if (!membership) return responseError(404, 'COMMUNITY_MEMBER_NOT_FOUND');
    const updated = { ...membership, role, roleUpdatedBy: userId, roleUpdatedAt: now() }; await db.send(new PutCommand({ TableName: table, Item: updated })); await put({ pk: `AUDIT#${id()}`, sk: 'PROFILE', type: 'AUDIT_LOG', action: 'COMMUNITY_ROLE_UPDATED', communityId, subjectId: memberId, role, actorId: userId, createdAt: now() }); return json(200, updated);
  }
  const cosignPath = path.match(/^\/v1\/skills\/([^/]+)\/cosigns$/);
  if (cosignPath && method === 'POST') { const targetUserId = input.targetUserId; if (!targetUserId || targetUserId === userId) return responseError(400, 'targetUserId is required'); const signer = await activePassportForUser(userId); const target = await activePassportForUser(targetUserId); if (!signer || !target) return responseError(404, 'ACTIVE_PASSPORT_NOT_FOUND'); const item = { pk: `USER#${targetUserId}`, sk: `COSIGN#${cosignPath[1]}#${userId}`, type: 'SKILL_COSIGN', skill: cosignPath[1], signerId: userId, signerPassportNo: signer.passportNo, targetUserId, targetPassportNo: target.passportNo, message: String(input.message || '').slice(0, 280), createdAt: now() }; return json(201, await put(item)); }
  if (path === '/v1/coach' && method === 'GET') { const profile = await get(`USER#${userId}`, 'PROFILE'); const skills = (await db.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)', ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'SKILL#' } }))).Items || []; const primary = profile?.primarySkill || skills[0]?.skill || 'general'; const gigs = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi1', KeyConditionExpression: 'gsi1pk = :pk', ExpressionAttributeValues: { ':pk': 'GIGS#OPEN' }, Limit: 50 })); return json(200, { summary: { cred: profile?.cred || 500, primarySkill: primary }, suggestions: (gigs.Items || []).filter((gig) => gig.skill === primary).slice(0, 10), nextStep: 'Complete gigs and keep your skill badge verified.' }); }
  if (path === '/v1/lineage' && method === 'GET') {
    const passports = (await db.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': `USER#${userId}` } }))).Items?.filter((x) => x.type === 'PASSPORT') || [];
    const current = passports.sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)))[0]; const lineage = [];
    let parentPassportNo = current?.vowchedBy || null; let depth = 1;
    while (parentPassportNo && depth <= 12) { const parent = (await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi1', KeyConditionExpression: 'gsi1pk = :pk', ExpressionAttributeValues: { ':pk': `PASSPORT_NO#${parentPassportNo}` } }))).Items?.[0]; if (!parent) break; lineage.push(parent); parentPassportNo = parent.vowchedBy || null; depth += 1; }
    return json(200, { current, lineage: lineage.reverse() });
  }
  if (path === '/v1/house' && method === 'GET') {
    const passport = await activePassportForUser(userId); if (!passport) return responseError(404, 'ACTIVE_PASSPORT_NOT_FOUND');
    const result = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi2', KeyConditionExpression: 'gsi2pk = :pk', ExpressionAttributeValues: { ':pk': `VOWCHER#${passport.passportNo}` }, ScanIndexForward: false, Limit: 100 }));
    return json(200, { rootPassportNo: passport.passportNo, members: (result.Items || []).map(treeNode), count: result.Items?.length || 0, nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url') : null });
  }
  if (path === '/v1/house/tree' && method === 'GET') {
    const passport = await activePassportForUser(userId); if (!passport) return responseError(404, 'ACTIVE_PASSPORT_NOT_FOUND');
    const maxDepth = Math.min(Math.max(Number(event.queryStringParameters?.depth || 12), 1), 12); const maxNodes = Math.min(Math.max(Number(event.queryStringParameters?.limit || 250), 1), 250);
    const tree = await houseTree(passport, { maxDepth, maxNodes });
    return json(200, { rootPassportNo: passport.passportNo, nodes: tree.nodes.map(treeNode), edges: tree.edges, truncated: tree.truncated, maxDepth, maxNodes });
  }
  if (path === '/v1/house/stats' && method === 'GET') {
    const passport = await activePassportForUser(userId); if (!passport) return responseError(404, 'ACTIVE_PASSPORT_NOT_FOUND');
    const tree = await houseTree(passport); const descendants = tree.nodes.slice(1); const active = descendants.filter((item) => item.status === 'ACTIVE');
    const skillDistribution = Object.entries(descendants.reduce((summary, item) => ({ ...summary, [item.primarySkill || 'general']: (summary[item.primarySkill || 'general'] || 0) + 1 }), {})).map(([skill, members]) => ({ skill, members })).sort((a, b) => b.members - a.members);
    return json(200, { rootPassportNo: passport.passportNo, descendants: descendants.length, activeMembers: active.length, revokedMembers: descendants.filter((item) => item.status === 'REVOKED').length, averageCred: active.length ? Math.round(active.reduce((total, item) => total + Number(item.cred || 0), 0) / active.length) : 0, skillDistribution, truncated: tree.truncated });
  }
  if (path === '/v1/house/health' && method === 'GET') {
    const passport = await activePassportForUser(userId); if (!passport) return responseError(404, 'ACTIVE_PASSPORT_NOT_FOUND');
    const tree = await houseTree(passport); const descendants = tree.nodes.slice(1); const active = descendants.filter((item) => item.status === 'ACTIVE'); const revoked = descendants.filter((item) => item.status === 'REVOKED').length;
    const averageCred = active.length ? active.reduce((total, item) => total + Number(item.cred || 0), 0) / active.length : Number(passport.cred || 0);
    const healthScore = Math.max(0, Math.min(100, Math.round(60 + (averageCred - 500) / 12 - (descendants.length ? revoked / descendants.length : 0) * 45)));
    return json(200, { rootPassportNo: passport.passportNo, healthScore, label: healthScore >= 80 ? 'STRONG' : healthScore >= 55 ? 'WATCH' : 'AT_RISK', activeMembers: active.length, revokedMembers: revoked, averageCred: Math.round(averageCred), truncated: tree.truncated });
  }
  if (path === '/v1/house/mentoring' && method === 'POST') {
    if (!input.targetPassportNo) return responseError(400, 'targetPassportNo is required');
    const mentorPassport = await activePassportForUser(userId); const target = await passportByNumber(input.targetPassportNo);
    if (!mentorPassport || !target || target.status !== 'ACTIVE') return responseError(404, 'ACTIVE_PASSPORT_NOT_FOUND');
    const tree = await houseTree(mentorPassport); if (!tree.nodes.some((item) => item.passportNo === target.passportNo) || target.userId === userId) return responseError(403, 'TARGET_NOT_IN_YOUR_HOUSE');
    const request = { pk: `USER#${target.userId}`, sk: `MENTORING#${id()}`, type: 'MENTORING_REQUEST', fromUserId: userId, fromPassportNo: mentorPassport.passportNo, targetPassportNo: target.passportNo, message: String(input.message || '').slice(0, 500), status: 'PENDING', createdAt: now() };
    await put(request); await enqueueNotification(target.userId, { notificationType: 'MENTORING_REQUEST', title: 'Mentoring offer', message: 'Someone in your House offered mentoring.', data: { requestId: request.sk.replace('MENTORING#', '') } });
    return json(201, request);
  }
  if (path === '/v1/house/introductions' && method === 'POST') {
    if (!input.targetPassportNo) return responseError(400, 'targetPassportNo is required');
    const senderPassport = await activePassportForUser(userId); const target = await passportByNumber(input.targetPassportNo);
    if (!senderPassport || !target || target.status !== 'ACTIVE') return responseError(404, 'ACTIVE_PASSPORT_NOT_FOUND');
    const tree = await houseTree(senderPassport); if (!tree.nodes.some((item) => item.passportNo === target.passportNo) || target.userId === userId) return responseError(403, 'TARGET_NOT_IN_YOUR_HOUSE');
    const introduction = { pk: `USER#${target.userId}`, sk: `INTRODUCTION#${id()}`, type: 'HOUSE_INTRODUCTION', fromUserId: userId, fromPassportNo: senderPassport.passportNo, targetPassportNo: target.passportNo, message: String(input.message || '').slice(0, 500), status: 'SENT', createdAt: now() };
    await put(introduction); await enqueueNotification(target.userId, { notificationType: 'HOUSE_INTRODUCTION', title: 'House introduction', message: 'You received an introduction from someone in your House.', data: { introductionId: introduction.sk.replace('INTRODUCTION#', '') } });
    return json(201, introduction);
  }
  if (path === '/v1/referrals/summary' && method === 'GET') {
    const profile = await get(`USER#${userId}`, 'PROFILE'); const passport = await activePassportForUser(userId);
    if (!profile?.onboardingComplete || !passport) return responseError(409, 'ACTIVE_PASSPORT_REQUIRED');
    const direct = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi2', KeyConditionExpression: 'gsi2pk = :pk', ExpressionAttributeValues: { ':pk': `VOWCHER#${passport.passportNo}` }, Select: 'COUNT' }));
    const capacity = Number(profile.inviteCapacity ?? 3); const issued = Number(profile.invitesIssued ?? 0);
    return json(200, { passportNo: passport.passportNo, inviteCapacity: capacity, invitesIssued: issued, invitesRemaining: Math.max(0, capacity - issued), referralsRedeemed: Number(profile.referralsRedeemed ?? 0), directVowches: Number(direct.Count ?? 0), lastReferralAt: profile.lastReferralAt || null });
  }
  if (path === '/v1/passports' && method === 'POST') {
    if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED');
    const counter = await db.send(new UpdateCommand({ TableName: table, Key: { pk: 'SYSTEM', sk: 'PASSPORT_COUNTER' }, UpdateExpression: 'ADD #value :one', ExpressionAttributeNames: { '#value': 'value' }, ExpressionAttributeValues: { ':one': 1 }, ReturnValues: 'UPDATED_NEW' }));
    const passportNo = String(counter.Attributes.value).padStart(7, '0'); const parentPassportNo = input.vowchedByPassportNo || null; const parent = await passportByNumber(parentPassportNo); const issuedAt = now();
    if (parentPassportNo && (!parent || parent.status !== 'ACTIVE')) return responseError(409, 'PARENT_PASSPORT_NOT_ACTIVE');
    if (!parent && !input.founderGenesis) return responseError(400, 'vowchedByPassportNo is required unless founderGenesis is true');
    const chainHash = parent ? createHash('sha256').update(`${passportNo}:${userId}:${issuedAt}:${parent.chainHash}`).digest('hex') : 'GENESIS';
    const passport = { pk: `USER#${userId}`, sk: `PASSPORT#${passportNo}`, gsi1pk: `PASSPORT_NO#${passportNo}`, gsi1sk: userId, ...(parent ? { gsi2pk: `VOWCHER#${parent.passportNo}`, gsi2sk: passportNo } : {}), gsi3pk: `SKILL#${input.primarySkill || 'general'}`, gsi3sk: `0500#${userId}`, type: 'PASSPORT', userId, passportNo, primarySkill: input.primarySkill || null, vowchedBy: parent?.passportNo || null, generation: parent ? Number(parent.generation || 0) + 1 : 0, lineage: parent ? [...(parent.lineage || [parent.passportNo]), passportNo] : [passportNo], status: 'ACTIVE', cred: 500, issuedAt, chainHash };
    return json(201, await put(passport));
  }
  const passportVerify = path.match(/^\/v1\/passports\/([^/]+)\/verify$/);
  if (passportVerify && method === 'GET') {
    let passport = await passportByNumber(passportVerify[1]); if (!passport) return responseError(404, 'PASSPORT_NOT_FOUND');
    const verified = []; let valid = true; let reason = null; let depth = 0;
    while (passport && depth <= 12) {
      verified.push(passport.passportNo);
      if (!passport.vowchedBy) {
        if (passport.chainHash !== 'GENESIS') { valid = false; reason = 'INVALID_GENESIS_HASH'; }
        break;
      }
      const parent = await passportByNumber(passport.vowchedBy);
      if (!parent) { valid = false; reason = 'PARENT_PASSPORT_NOT_FOUND'; break; }
      const expected = createHash('sha256').update(`${passport.passportNo}:${passport.userId}:${passport.issuedAt}:${parent.chainHash}`).digest('hex');
      if (passport.chainHash !== expected) { valid = false; reason = 'INVALID_CHAIN_HASH'; break; }
      passport = parent; depth += 1;
    }
    if (depth > 12) { valid = false; reason = 'CHAIN_DEPTH_EXCEEDED'; }
    return json(200, { passportNo: passportVerify[1], status: (await passportByNumber(passportVerify[1]))?.status, valid, reason, verifiedPassportNumbers: verified, depth: verified.length - 1 });
  }
  if (path === '/v1/invites' && method === 'POST') {
    if (!(await rateLimit(`invite:${userId}`, 20, 86400))) return responseError(429, 'RATE_LIMITED');
    const profile = await get(`USER#${userId}`, 'PROFILE'); const inviterPassport = await activePassportForUser(userId);
    if (!profile?.onboardingComplete || !inviterPassport) return responseError(409, 'ACTIVE_PASSPORT_REQUIRED');
    const inviteCapacity = isAdmin(event) ? 1000000000 : Number(profile.inviteCapacity ?? 3); const invitesIssued = Number(profile.invitesIssued ?? 0);
    if (invitesIssued >= inviteCapacity) return responseError(409, 'INVITE_CAPACITY_REACHED');
    const inviteId = id(); const code = createHash('sha256').update(inviteId).digest('hex').slice(0, 12); const stakePreview = { scope: 'Confirmed fraud or repeated serious misconduct only', maxCredImpact: 5, excludes: ['ordinary low ratings', 'subjective client dissatisfaction'] };
    const invite = { pk: `INVITE#${inviteId}`, sk: 'PROFILE', gsi1pk: `INVITE_CODE#${code}`, gsi1sk: inviteId, type: 'INVITE', inviteId, inviterId: userId, inviterPassportNo: inviterPassport.passportNo, code, status: 'ISSUED', stakePreview, createdAt: now() };
    try { await db.send(new TransactWriteCommand({ TransactItems: [
      { Update: { TableName: table, Key: { pk: `USER#${userId}`, sk: 'PROFILE' }, UpdateExpression: 'ADD invitesIssued :one SET updatedAt = :at', ConditionExpression: 'attribute_exists(pk) AND (attribute_not_exists(invitesIssued) OR invitesIssued < :capacity)', ExpressionAttributeValues: { ':one': 1, ':at': now(), ':capacity': inviteCapacity } } },
      { Put: { TableName: table, Item: invite, ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)' } }
    ] })); } catch (error) { return responseError(error.name === 'TransactionCanceledException' ? 409 : 500, error.name === 'TransactionCanceledException' ? 'INVITE_CAPACITY_REACHED' : 'INVITE_CREATE_FAILED'); }
    return json(201, { ...invite, remainingCapacity: inviteCapacity - invitesIssued - 1 });
  }
  if (path === '/v1/invites/redeem' && method === 'POST') {
    if (!input.code) return responseError(400, 'code is required');
    const found = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi1', KeyConditionExpression: 'gsi1pk = :pk', ExpressionAttributeValues: { ':pk': `INVITE_CODE#${input.code}` } }));
    const invite = found.Items?.[0]; if (!invite || invite.status !== 'ISSUED') return responseError(404, 'INVITE_INVALID_OR_REDEEMED');
    return json(200, { valid: true, inviteCode: invite.code, stake: invite.stakePreview, message: 'Complete onboarding to redeem this invitation.' });
  }
  if (path === '/v1/poster/verification' && method === 'GET') {
    const profile = await get(`USER#${userId}`, 'PROFILE');
    return json(200, { status: profile?.posterVerificationStatus || 'UNVERIFIED', submittedAt: profile?.posterVerificationSubmittedAt || null, verifiedAt: profile?.posterVerifiedAt || null, reason: profile?.posterVerificationReason || null });
  }
  if (path === '/v1/poster/verification' && method === 'POST') {
    const profile = await get(`USER#${userId}`, 'PROFILE') || { pk: `USER#${userId}`, sk: 'PROFILE', type: 'USER', userId, createdAt: now() };
    if (!input.legalName && !input.businessName) return responseError(400, 'legalName or businessName is required');
    const updated = { ...profile, posterVerificationStatus: 'PENDING', posterVerification: { legalName: String(input.legalName || ''), businessName: String(input.businessName || ''), website: String(input.website || ''), country: String(input.country || '') }, posterVerificationSubmittedAt: now(), updatedAt: now() };
    await db.send(new PutCommand({ TableName: table, Item: updated }));
    await put({ pk: `AUDIT#${id()}`, sk: 'PROFILE', type: 'AUDIT_LOG', action: 'POSTER_VERIFICATION_SUBMITTED', subjectId: userId, actorId: userId, createdAt: now() });
    return json(202, { status: updated.posterVerificationStatus, submittedAt: updated.posterVerificationSubmittedAt });
  }
  if (path === '/v1/poster/dashboard' && method === 'GET') {
    const result = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi4', KeyConditionExpression: 'gsi4pk = :pk', ExpressionAttributeValues: { ':pk': `POSTER#${userId}` }, ScanIndexForward: false, Limit: Math.min(Number(event.queryStringParameters?.limit || 50), 100) }));
    const gigs = result.Items || []; const counts = gigs.reduce((summary, gig) => ({ ...summary, [gig.status]: (summary[gig.status] || 0) + 1 }), {}); const profile = await get(`USER#${userId}`, 'PROFILE');
    return json(200, { poster: { userId, verificationStatus: profile?.posterVerificationStatus || 'UNVERIFIED', cred: Number(profile?.cred || 0) }, gigs, counts, nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url') : null });
  }
  if (path === '/v1/poster/reputation' && method === 'GET') {
    const profile = await get(`USER#${userId}`, 'PROFILE'); const passports = await activePassportForUser(userId);
    return json(200, { userId, cred: Number(profile?.cred || 0), verificationStatus: profile?.posterVerificationStatus || 'UNVERIFIED', passportNo: passports?.passportNo || null, accountStatus: profile?.accountStatus || 'ACTIVE' });
  }
  if (path === '/v1/gigs' && method === 'POST') {
    if (!(await rateLimit(`gig:${userId}`, 30, 3600))) return responseError(429, 'RATE_LIMITED');
    if (!input.title || !input.description) return responseError(400, 'title and description are required');
    if (!Number.isInteger(input.budgetPaise) || input.budgetPaise < 100) return responseError(400, 'budgetPaise must be an integer of at least 100');
    const profile = await get(`USER#${userId}`, 'PROFILE'); const gigId = id(); const createdAt = now(); const deadlineAt = input.deadlineAt && !Number.isNaN(Date.parse(input.deadlineAt)) ? new Date(input.deadlineAt).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString(); const requirements = { minCred: Math.max(0, Math.min(1000, Number(input.requirements?.minCred || 0))), minRating: Math.max(0, Math.min(5, Number(input.requirements?.minRating || 0))), verifiedSkillOnly: input.requirements?.verifiedSkillOnly === true, houseOnly: input.requirements?.houseOnly === true };
    if ((input.workMode || 'REMOTE') !== 'REMOTE') return responseError(400, 'REMOTE_ONLY_V1');
    const gig = { pk: `GIG#${gigId}`, sk: 'PROFILE', gsi1pk: 'GIGS#DRAFT', gsi1sk: createdAt, gsi4pk: `POSTER#${userId}`, gsi4sk: createdAt, type: 'GIG', gigId, posterId: userId, posterVerificationStatus: profile?.posterVerificationStatus || 'UNVERIFIED', title: input.title, description: input.description, skill: input.skill || 'general', requirements, budgetPaise: input.budgetPaise, deadlineAt, location: null, workMode: 'REMOTE', status: 'DRAFT', createdAt };
    return json(201, await put(gig));
  }
  if (path === '/v1/gigs' && method === 'GET') return json(200, (await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi1', KeyConditionExpression: 'gsi1pk = :pk', ExpressionAttributeValues: { ':pk': 'GIGS#OPEN' } }))).Items || []);
  const matchPath = path.match(/^\/v1\/gigs\/([^/]+)\/matches$/);
  if (matchPath && method === 'GET') {
    const gig = await get(`GIG#${matchPath[1]}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND');
    const result = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi3', KeyConditionExpression: 'gsi3pk = :skill', ExpressionAttributeValues: { ':skill': `SKILL#${gig.skill}` }, Limit: 100 }));
    const posterPassport = await activePassportForUser(gig.posterId); const house = gig.requirements?.houseOnly && posterPassport ? new Set((await houseTree(posterPassport)).nodes.map((item) => item.userId)) : null;
    const candidates = []; for (const item of result.Items || []) { if (item.status !== 'ACTIVE' || item.userId === gig.posterId || Number(item.cred || 0) < Number(gig.requirements?.minCred || 0) || (house && !house.has(item.userId))) continue; const skill = await get(`USER#${item.userId}`, `SKILL#${gig.skill}`); const rating = skill?.ratingCount ? Number(skill.ratingSum || 0) / Number(skill.ratingCount) : 0; if (rating < Number(gig.requirements?.minRating || 0)) continue; if (gig.requirements?.verifiedSkillOnly && skill?.badgeStatus !== 'VERIFIED' && skill?.badgeStatus !== 'PROVEN') continue; candidates.push({ ...item, rating, matchScore: Number(item.cred || 0) + Math.round(rating * 20) + (skill?.badgeStatus ? 25 : 0) }); }
    candidates.sort((a, b) => b.matchScore - a.matchScore);
    return json(200, { gigId: gig.gigId, candidates });
  }
  const candidateAction = path.match(/^\/v1\/gigs\/([^/]+)\/candidates\/([^/]+)\/(shortlist|accept|decline)$/);
  if (candidateAction && method === 'POST') {
    const gig = await get(`GIG#${candidateAction[1]}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND');
    if (gig.posterId !== userId) return responseError(403, 'ONLY_POSTER');
    if (!['OPEN', 'OFFER_PENDING'].includes(gig.status)) return responseError(409, 'GIG_NOT_ACCEPTING_CANDIDATE_ACTIONS');
    const candidateId = candidateAction[2]; const action = candidateAction[3]; const candidatePassport = await activePassportForUser(candidateId);
    if (!candidatePassport) return responseError(404, 'CANDIDATE_NOT_ACTIVE');
    if (action === 'shortlist') {
      const shortlist = { pk: `GIG#${gig.gigId}`, sk: `SHORTLIST#${candidateId}`, type: 'SHORTLIST', gigId: gig.gigId, candidateId, candidatePassportNo: candidatePassport.passportNo, status: 'SHORTLISTED', note: String(input.note || '').slice(0, 500), createdAt: now() };
      try { await put(shortlist); } catch (error) { if (error.name !== 'ConditionalCheckFailedException') throw error; }
      await enqueueNotification(candidateId, { notificationType: 'GIG_SHORTLISTED', title: 'You were shortlisted', message: `You were shortlisted for ${gig.title}.`, data: { gigId: gig.gigId } });
      return json(201, shortlist);
    }
    const application = await get(`GIG#${gig.gigId}`, `APPLICATION#${candidateId}`);
    if (action === 'decline') {
      if (!application) return responseError(404, 'APPLICATION_NOT_FOUND');
      const updated = { ...application, status: 'DECLINED_BY_POSTER', decisionBy: userId, decisionAt: now(), decisionNote: String(input.note || '').slice(0, 500) };
      await db.send(new PutCommand({ TableName: table, Item: updated, ConditionExpression: '#status = :applied', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':applied': 'APPLIED' } }));
      await enqueueNotification(candidateId, { notificationType: 'APPLICATION_DECLINED', title: 'Application update', message: `Your application for ${gig.title} was not selected.`, data: { gigId: gig.gigId } });
      return json(200, updated);
    }
    if (gig.status !== 'OPEN') return responseError(409, 'GIG_ALREADY_HAS_AN_OFFER');
    const offer = { ...(application || { pk: `GIG#${gig.gigId}`, sk: `APPLICATION#${candidateId}`, gsi4pk: `WORKER#${candidateId}`, gsi4sk: now(), type: 'APPLICATION', gigId: gig.gigId, candidateId, appliedAt: now(), source: 'POSTER_MATCH' }), candidatePassportNo: candidatePassport.passportNo, status: 'OFFERED', offeredBy: userId, offeredAt: now(), offerNote: String(input.note || '').slice(0, 500) };
    const offeredGig = { ...gig, status: 'OFFER_PENDING', gsi1pk: 'GIGS#OFFER_PENDING', gsi1sk: now(), gsi2pk: 'GIG_EXPIRY#OFFER_PENDING', gsi2sk: `${gig.deadlineAt}#${gig.gigId}`, selectedWorkerId: candidateId, offerExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), updatedAt: now() };
    try { await db.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: table, Item: offer } },
      { Put: { TableName: table, Item: offeredGig, ConditionExpression: '#status = :open', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':open': 'OPEN' } } }
    ] })); } catch (error) { return responseError(error.name === 'TransactionCanceledException' ? 409 : 500, error.name === 'TransactionCanceledException' ? 'GIG_ALREADY_HAS_AN_OFFER' : 'OFFER_CREATE_FAILED'); }
    await enqueueNotification(candidateId, { notificationType: 'GIG_OFFER', title: 'You have a gig offer', message: `Accept or decline ${gig.title} within 24 hours.`, data: { gigId: gig.gigId } });
    return json(202, { gig: offeredGig, application: offer });
  }
  const shortlistPath = path.match(/^\/v1\/gigs\/([^/]+)\/shortlist$/);
  if (shortlistPath && method === 'GET') {
    const gig = await get(`GIG#${shortlistPath[1]}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND');
    if (gig.posterId !== userId) return responseError(403, 'ONLY_POSTER');
    const result = await db.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)', ExpressionAttributeValues: { ':pk': `GIG#${gig.gigId}`, ':prefix': 'SHORTLIST#' } }));
    return json(200, result.Items || []);
  }
  const applyPath = path.match(/^\/v1\/gigs\/([^/]+)\/applications$/);
  if (applyPath && method === 'POST') {
    const gig = await get(`GIG#${applyPath[1]}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND');
    if (gig.status !== 'OPEN') return responseError(409, 'GIG_NOT_OPEN');
    if (gig.posterId === userId) return responseError(403, 'POSTER_CANNOT_APPLY');
    const passport = await activePassportForUser(userId); if (!passport) return responseError(409, 'ACTIVE_PASSPORT_REQUIRED');
    const profile = await get(`USER#${userId}`, 'PROFILE'); if (profile?.availabilityStatus && profile.availabilityStatus !== 'AVAILABLE') return responseError(409, 'WORKER_NOT_AVAILABLE');
    const appliedAt = now(); const application = { pk: `GIG#${gig.gigId}`, sk: `APPLICATION#${userId}`, gsi4pk: `WORKER#${userId}`, gsi4sk: appliedAt, type: 'APPLICATION', gigId: gig.gigId, candidateId: userId, candidatePassportNo: passport.passportNo, status: 'APPLIED', proposal: String(input.proposal || '').slice(0, 2000), proposedAmountPaise: Number.isInteger(input.proposedAmountPaise) ? input.proposedAmountPaise : null, appliedAt };
    try { await put(application); } catch (error) { if (error.name === 'ConditionalCheckFailedException') return responseError(409, 'ALREADY_APPLIED'); throw error; }
    await enqueueNotification(gig.posterId, { notificationType: 'GIG_APPLICATION', title: 'New application', message: 'A worker applied to your gig.', data: { gigId: gig.gigId, applicantId: userId } });
    return json(201, application);
  }
  if (applyPath && method === 'GET') {
    const gig = await get(`GIG#${applyPath[1]}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND');
    if (gig.posterId !== userId && !isAdmin(event)) return responseError(403, 'ONLY_POSTER');
    const applications = await db.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)', ExpressionAttributeValues: { ':pk': `GIG#${gig.gigId}`, ':prefix': 'APPLICATION#' }, ScanIndexForward: false }));
    return json(200, applications.Items || []);
  }
  if (path === '/v1/worker/availability' && method === 'GET') {
    const profile = await get(`USER#${userId}`, 'PROFILE'); return json(200, { status: profile?.availabilityStatus || 'AVAILABLE', schedule: profile?.availabilitySchedule || null, updatedAt: profile?.availabilityUpdatedAt || null });
  }
  if (path === '/v1/worker/availability' && method === 'PUT') {
    const status = String(input.status || '').toUpperCase(); if (!['AVAILABLE', 'PAUSED', 'UNAVAILABLE'].includes(status)) return responseError(400, 'status must be AVAILABLE, PAUSED, or UNAVAILABLE');
    const profile = await get(`USER#${userId}`, 'PROFILE') || { pk: `USER#${userId}`, sk: 'PROFILE', type: 'USER', userId, createdAt: now() };
    const updated = { ...profile, availabilityStatus: status, availabilitySchedule: Array.isArray(input.schedule) ? input.schedule.slice(0, 14) : null, availabilityUpdatedAt: now(), updatedAt: now() };
    await db.send(new PutCommand({ TableName: table, Item: updated })); return json(200, { status: updated.availabilityStatus, schedule: updated.availabilitySchedule, updatedAt: updated.availabilityUpdatedAt });
  }
  if (path === '/v1/worker/payout-account' && method === 'PUT') {
    const razorpayAccountId = String(input.razorpayAccountId || '').trim(); if (!/^acc_[A-Za-z0-9]+$/.test(razorpayAccountId)) return responseError(400, 'valid razorpayAccountId is required');
    const profile = await get(`USER#${userId}`, 'PROFILE') || { pk: `USER#${userId}`, sk: 'PROFILE', type: 'USER', userId, createdAt: now() };
    const updated = { ...profile, razorpayAccountId, payoutAccountStatus: 'PENDING_VERIFICATION', payoutAccountUpdatedAt: now(), updatedAt: now() };
    await db.send(new PutCommand({ TableName: table, Item: updated }));
    return json(200, { razorpayAccountId, status: updated.payoutAccountStatus });
  }
  if (path === '/v1/worker/applications' && method === 'GET') {
    const result = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi4', KeyConditionExpression: 'gsi4pk = :pk', ExpressionAttributeValues: { ':pk': `WORKER#${userId}` }, ScanIndexForward: false, Limit: Math.min(Number(event.queryStringParameters?.limit || 50), 100) }));
    return json(200, { items: result.Items || [], nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url') : null });
  }
  const offerAction = path.match(/^\/v1\/gigs\/([^/]+)\/offer\/(accept|decline)$/);
  if (offerAction && method === 'POST') {
    const gig = await get(`GIG#${offerAction[1]}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND');
    if (gig.status !== 'OFFER_PENDING' || gig.selectedWorkerId !== userId) return responseError(409, 'NO_ACTIVE_OFFER');
    if (gig.offerExpiresAt && new Date(gig.offerExpiresAt) < new Date()) return responseError(409, 'OFFER_EXPIRED');
    const application = await get(`GIG#${gig.gigId}`, `APPLICATION#${userId}`); if (!application || application.status !== 'OFFERED') return responseError(409, 'OFFER_RECORD_NOT_FOUND');
    const accepted = offerAction[2] === 'accept';
    const nextGig = accepted ? { ...gig, status: 'ASSIGNED', gsi1pk: 'GIGS#ASSIGNED', gsi1sk: now(), doerId: userId, assignedAt: now(), updatedAt: now() } : (() => { const { selectedWorkerId, offerExpiresAt, ...reopened } = gig; return { ...reopened, status: 'OPEN', gsi1pk: 'GIGS#OPEN', gsi1sk: now(), updatedAt: now() }; })();
    const nextApplication = { ...application, status: accepted ? 'ACCEPTED' : 'DECLINED_BY_WORKER', respondedAt: now(), responseNote: String(input.note || '').slice(0, 500) };
    try { await db.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: table, Item: nextGig, ConditionExpression: '#status = :pending', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':pending': 'OFFER_PENDING' } } },
      { Put: { TableName: table, Item: nextApplication, ConditionExpression: '#status = :offered', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':offered': 'OFFERED' } } }
    ] })); } catch (error) { return responseError(error.name === 'TransactionCanceledException' ? 409 : 500, error.name === 'TransactionCanceledException' ? 'OFFER_ALREADY_RESPONDED' : 'OFFER_RESPONSE_FAILED'); }
    await put({ pk: `GIG#${gig.gigId}`, sk: `STATUS_EVENT#${Date.now()}#${id()}`, type: 'GIG_STATUS_EVENT', gigId: gig.gigId, status: nextGig.status, actorId: userId, createdAt: now() });
    await enqueueNotification(gig.posterId, { notificationType: accepted ? 'GIG_OFFER_ACCEPTED' : 'GIG_OFFER_DECLINED', title: accepted ? 'Gig offer accepted' : 'Gig offer declined', message: accepted ? 'Your worker accepted the gig offer.' : 'Your worker declined the gig offer; the gig is open again.', data: { gigId: gig.gigId } });
    return json(200, { gig: nextGig, application: nextApplication });
  }
  if (path === '/v1/worker/gigs' && method === 'GET') {
    const applications = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi4', KeyConditionExpression: 'gsi4pk = :pk', ExpressionAttributeValues: { ':pk': `WORKER#${userId}` }, ScanIndexForward: false, Limit: 100 }));
    const accepted = (applications.Items || []).filter((item) => item.status === 'ACCEPTED'); const gigs = await Promise.all(accepted.map((item) => get(`GIG#${item.gigId}`, 'PROFILE')));
    return json(200, gigs.filter(Boolean));
  }
  if (path === '/v1/worker/earnings' && method === 'GET') {
    const result = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi4', KeyConditionExpression: 'gsi4pk = :pk', ExpressionAttributeValues: { ':pk': `EARNINGS#${userId}` }, ScanIndexForward: false, Limit: Math.min(Number(event.queryStringParameters?.limit || 50), 100) }));
    const items = result.Items || []; return json(200, { items, totalReleasedPaise: items.filter((item) => item.status === 'RELEASED').reduce((total, item) => total + Number(item.amountPaise || 0), 0), nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url') : null });
  }
  const gigDetail = path.match(/^\/v1\/gigs\/([^/]+)$/);
  if (gigDetail && method === 'GET') {
    const gig = await get(`GIG#${gigDetail[1]}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND');
    return json(200, gig);
  }
  if (gigDetail && method === 'PATCH') {
    const gig = await get(`GIG#${gigDetail[1]}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND');
    if (gig.posterId !== userId) return responseError(403, 'ONLY_POSTER');
    if (!['OPEN'].includes(gig.status)) return responseError(409, 'GIG_NOT_EDITABLE');
    const updated = { ...gig, title: input.title ?? gig.title, description: input.description ?? gig.description, skill: input.skill ?? gig.skill, budgetPaise: input.budgetPaise ?? gig.budgetPaise, updatedAt: now() };
    await db.send(new PutCommand({ TableName: table, Item: updated, ConditionExpression: '#status = :open', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':open': 'OPEN' } })); return json(200, updated);
  }
  const gigMatch = path.match(/^\/v1\/gigs\/([^/]+)\/(assign|deliver|approve|dispute|cancel)$/);
  if (gigMatch && method === 'POST') {
    const gig = await get(`GIG#${gigMatch[1]}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND');
    const next = { assign: 'ASSIGNED', deliver: 'DELIVERED', approve: 'COMPLETED', dispute: 'DISPUTED', cancel: 'CANCELLED' }[gigMatch[2]];
    if (gigMatch[2] === 'assign' && !input.doerId) return responseError(400, 'doerId is required');
    if (gigMatch[2] === 'assign' && !(await get(`USER#${input.doerId}`, 'PROFILE'))?.razorpayAccountId) return responseError(409, 'WORKER_PAYOUT_ACCOUNT_REQUIRED');
    if (gigMatch[2] === 'deliver' && gig.doerId !== userId) return responseError(403, 'ONLY_ASSIGNED_DOER');
    if (['approve', 'dispute', 'cancel'].includes(gigMatch[2]) && gig.posterId !== userId && gig.doerId !== userId) return responseError(403, 'NOT_PARTICIPANT');
    if (gigMatch[2] === 'assign' && gig.posterId !== userId) return responseError(403, 'ONLY_POSTER');
    const expected = { assign: 'OPEN', deliver: 'ASSIGNED', approve: 'DELIVERED', dispute: 'DELIVERED', cancel: ['OPEN', 'ASSIGNED'] }[gigMatch[2]];
    const expectedExpression = Array.isArray(expected) ? expected.map((_, index) => `#status = :expected${index}`).join(' OR ') : '#status = :expected0';
    const expectedValues = Array.isArray(expected) ? Object.fromEntries(expected.map((value, index) => [`:expected${index}`, value])) : { ':expected0': expected };
    try {
      await db.send(new UpdateCommand({ TableName: table, Key: { pk: gig.pk, sk: gig.sk }, UpdateExpression: 'SET #status = :next, gsi1pk = :statusIndex, gsi1sk = :updated, updatedAt = :updated, reason = :reason, doerId = if_not_exists(doerId, :doer)', ConditionExpression: expectedExpression, ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':next': next, ':statusIndex': `GIGS#${next}`, ':updated': now(), ':reason': input.reason || '', ':doer': input.doerId || gig.doerId || '', ...expectedValues } }));
    } catch (error) { if (error.name === 'ConditionalCheckFailedException') return responseError(409, 'STALE_GIG_STATE'); throw error; }
    if (gigMatch[2] === 'assign') { try { await bindEscrowToDoer(gig.gigId, input.doerId); } catch (error) { return responseError(error.message === 'WORKER_PAYOUT_ACCOUNT_REQUIRED' ? 409 : 502, error.message || 'ESCROW_ASSIGNMENT_FAILED'); } }
    await put({ pk: `GIG#${gig.gigId}`, sk: `STATUS_EVENT#${Date.now()}#${id()}`, type: 'GIG_STATUS_EVENT', gigId: gig.gigId, status: next, previousStatus: gig.status, actorId: userId, createdAt: now() }); await emitEvent(`gig.${next.toLowerCase()}`, { gigId: gig.gigId, previousStatus: gig.status, status: next, actorId: userId });
    const recipients = [gig.posterId, gig.doerId || input.doerId].filter(Boolean);
    await Promise.all([...new Set(recipients)].map((recipientId) => broadcastEvent(recipientId, 'GIG_STATUS', { gigId: gig.gigId, status: next, previousStatus: gig.status })));
    await Promise.all([...new Set(recipients)].map((recipientId) => enqueueNotification(recipientId, { notificationType: `GIG_${next}`, title: 'Gig updated', message: `Gig ${next.toLowerCase()}`, data: { gigId: gig.gigId, status: next } })));
    return json(200, { ...gig, status: next, ...(input.doerId ? { doerId: input.doerId } : {}) });
  }
  const messagesPath = path.match(/^\/v1\/gigs\/([^/]+)\/messages$/);
  if (messagesPath && method === 'GET') {
    const gig = await get(`GIG#${messagesPath[1]}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND');
    if (![gig.posterId, gig.doerId, gig.selectedWorkerId].filter(Boolean).includes(userId) && !isAdmin(event)) return responseError(403, 'NOT_GIG_PARTICIPANT');
    const result = await db.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)', ExpressionAttributeValues: { ':pk': `GIG#${gig.gigId}`, ':prefix': 'MESSAGE#' }, ScanIndexForward: true, Limit: Math.min(Number(event.queryStringParameters?.limit || 50), 100) }));
    return json(200, { items: result.Items || [], nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url') : null });
  }
  if (messagesPath && method === 'POST') {
    const gig = await get(`GIG#${messagesPath[1]}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND');
    if (![gig.posterId, gig.doerId, gig.selectedWorkerId].filter(Boolean).includes(userId)) return responseError(403, 'NOT_GIG_PARTICIPANT');
    const message = String(input.message || '').trim(); if (!message || message.length > 2000) return responseError(400, 'message must be 1-2000 characters');
    const item = { pk: `GIG#${gig.gigId}`, sk: `MESSAGE#${Date.now()}#${id()}`, type: 'GIG_MESSAGE', gigId: gig.gigId, senderId: userId, message, createdAt: now() };
    await put(item); const recipients = [gig.posterId, gig.doerId, gig.selectedWorkerId].filter((recipient) => recipient && recipient !== userId);
    await Promise.all([...new Set(recipients)].map((recipientId) => enqueueNotification(recipientId, { notificationType: 'GIG_MESSAGE', title: 'New gig message', message: `New message on ${gig.title}.`, data: { gigId: gig.gigId } })));
    return json(201, item);
  }
  const eventsPath = path.match(/^\/v1\/gigs\/([^/]+)\/events$/);
  if (eventsPath && method === 'GET') {
    const gig = await get(`GIG#${eventsPath[1]}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND');
    if (![gig.posterId, gig.doerId, gig.selectedWorkerId].filter(Boolean).includes(userId) && !isAdmin(event)) return responseError(403, 'NOT_GIG_PARTICIPANT');
    const result = await db.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)', ExpressionAttributeValues: { ':pk': `GIG#${gig.gigId}`, ':prefix': 'STATUS_EVENT#' }, ScanIndexForward: false, Limit: Math.min(Number(event.queryStringParameters?.limit || 50), 100) }));
    return json(200, { currentStatus: gig.status, items: result.Items || [], nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url') : null });
  }
  if (path === '/v1/uploads/presign' && method === 'POST') {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']; const maxBytes = 25 * 1024 * 1024;
    if (!allowed.includes(input.contentType) || Number(input.sizeBytes || 0) > maxBytes) return responseError(400, 'UNSUPPORTED_FILE');
    const key = `members/${userId}/${id()}-${input.filename || 'upload'}`; const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: input.contentType || 'application/octet-stream', ChecksumSHA256: input.checksumSha256 }), { expiresIn: 900 });
    return json(200, { key, uploadUrl: url, checksumSha256: input.checksumSha256 || null, malwareStatus: 'PENDING_SCAN', expiresIn: 900 });
  }
  if (path === '/v1/payments/intents' && method === 'POST') {
    if (!input.gigId || !Number.isInteger(input.amountPaise) || input.amountPaise < 100) return responseError(400, 'gigId and amountPaise are required');
    const intentId = id(); const intent = { pk: `PAYMENT#${intentId}`, sk: 'PROFILE', type: 'ESCROW_INTENT', intentId, gigId: input.gigId, posterId: userId, amountPaise: input.amountPaise, status: 'PENDING_PROVIDER', idempotencyKey: event.headers?.['idempotency-key'] || intentId, createdAt: now() };
    return json(201, await put(intent));
  }
  if (path === '/v1/payments/orders' && method === 'POST') {
    if (!(await rateLimit(`payment:${userId}`, 20, 3600))) return responseError(429, 'RATE_LIMITED');
    if (!input.gigId || !Number.isInteger(input.amountPaise) || input.amountPaise < 100) return responseError(400, 'gigId and amountPaise are required');
    const gig = await get(`GIG#${input.gigId}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND');
    if (gig.posterId !== userId) return responseError(403, 'ONLY_POSTER');
    if (gig.status !== 'DRAFT') return responseError(409, 'ESCROW_ALREADY_CREATED_OR_GIG_NOT_DRAFT');
    if (input.amountPaise !== Number(gig.budgetPaise)) return responseError(400, 'PAYMENT_AMOUNT_MUST_MATCH_GIG_BUDGET');
    const idempotencyKey = event.headers?.['idempotency-key'] || `order-${gig.gigId}-${input.amountPaise}`;
    let order; try { order = await createOrder(input.amountPaise, gig.gigId, { posterId: userId, gigId: gig.gigId }, idempotencyKey); } catch (error) { return responseError(error.message === 'PAYMENTS_NOT_CONFIGURED' ? 503 : 502, error.message === 'PAYMENTS_NOT_CONFIGURED' ? 'PAYMENTS_NOT_CONFIGURED' : 'PAYMENT_PROVIDER_ERROR'); }
    const paymentCreatedAt = now(); const record = { pk: `PAYMENT#${order.id}`, sk: 'PROFILE', type: 'ESCROW_ORDER', orderId: order.id, gigId: gig.gigId, posterId: userId, amountPaise: input.amountPaise, currency: 'INR', status: 'CREATED', idempotencyKey, createdAt: paymentCreatedAt }; Object.assign(record, paymentIndex(record, 'CREATED', paymentCreatedAt));
    await put(record); await paymentLedger(order.id, 'ORDER_CREATED', { gigId: gig.gigId, actorId: userId, amountPaise: input.amountPaise }); return json(201, { orderId: order.id, amount: order.amount, currency: order.currency, keyId: await runtimeSecret('razorpay/key-id', process.env.RAZORPAY_KEY_ID) });
  }
  const paymentAction = path.match(/^\/v1\/payments\/([^/]+)\/(release|refund)$/);
  if (paymentAction && method === 'POST') {
    const payment = await get(`PAYMENT#${paymentAction[1]}`, 'PROFILE'); if (!payment) return responseError(404, 'PAYMENT_NOT_FOUND');
    if (payment.posterId !== userId && !isAdmin(event)) return responseError(403, 'PAYMENT_FORBIDDEN');
    const action = paymentAction[2];
    if (!payment.providerPaymentId) return responseError(409, 'PROVIDER_PAYMENT_ID_REQUIRED');
    if (action === 'release' && !payment.razorpayAccountId) return responseError(409, 'WORKER_PAYOUT_ACCOUNT_REQUIRED');
    try { return json(202, await settlePayment(payment, action === 'refund' ? 'REFUND' : 'RELEASE', userId)); } catch (error) { return responseError(error.message === 'PAYMENT_NOT_ACTIONABLE' ? 409 : error.message === 'PAYMENTS_NOT_CONFIGURED' ? 503 : 502, error.message === 'PAYMENT_NOT_ACTIONABLE' ? 'PAYMENT_NOT_ACTIONABLE' : action === 'refund' ? 'REFUND_PROVIDER_ERROR' : 'PAYOUT_PROVIDER_ERROR'); }
  }
  const ledgerPath = path.match(/^\/v1\/payments\/([^/]+)\/ledger$/);
  if (ledgerPath && method === 'GET') return json(200, (await db.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': `PAYMENT_LEDGER#${ledgerPath[1]}` }, ScanIndexForward: false }))).Items || [], requestId);
  if (path === '/v1/payments/auto-release' && method === 'POST') {
    if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED');
    const paymentId = input.paymentId; if (!paymentId) return responseError(400, 'paymentId is required');
    const payment = await get(`PAYMENT#${paymentId}`, 'PROFILE'); if (!payment) return responseError(404, 'PAYMENT_NOT_FOUND');
    if (payment.reviewWindowEndsAt && new Date(payment.reviewWindowEndsAt) > new Date()) return responseError(409, 'REVIEW_WINDOW_OPEN');
    if (!payment.providerPaymentId || !payment.razorpayAccountId) return responseError(409, 'PAYOUT_DETAILS_REQUIRED');
    try { const updated = await settlePayment(payment, 'RELEASE', userId); return json(202, { ...updated, autoReleased: true }); } catch (error) { return responseError(error.message === 'PAYMENT_NOT_ACTIONABLE' ? 409 : 502, error.message === 'PAYMENT_NOT_ACTIONABLE' ? 'PAYMENT_NOT_ACTIONABLE' : 'PAYOUT_PROVIDER_ERROR'); }
  }
  const deliveryMatch = path.match(/^\/v1\/gigs\/([^/]+)\/delivery$/);
  if (deliveryMatch && method === 'POST') {
    const gig = await get(`GIG#${deliveryMatch[1]}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND');
    if (gig.doerId !== userId) return responseError(403, 'ONLY_ASSIGNED_DOER');
    if (!['ASSIGNED', 'DELIVERED'].includes(gig.status)) return responseError(409, 'GIG_NOT_READY_FOR_DELIVERY');
    if (!Array.isArray(input.files) || input.files.length === 0 || input.files.length > 20) return responseError(400, 'files must contain 1-20 uploaded files');
    const deliveryCounter = await db.send(new UpdateCommand({ TableName: table, Key: { pk: `GIG#${gig.gigId}`, sk: 'DELIVERY_COUNTER' }, UpdateExpression: 'ADD #value :one SET #type = :type', ExpressionAttributeNames: { '#value': 'value', '#type': 'type' }, ExpressionAttributeValues: { ':one': 1, ':type': 'DELIVERY_COUNTER' }, ReturnValues: 'UPDATED_NEW' }));
    const version = Number(deliveryCounter.Attributes?.value || 1); const createdAt = now();
    const delivery = { pk: `GIG#${gig.gigId}`, sk: `DELIVERY#${String(version).padStart(6, '0')}#${id()}`, type: 'DELIVERY', gigId: gig.gigId, doerId: userId, version, files: input.files, note: String(input.note || '').slice(0, 4000), status: 'SUBMITTED', createdAt };
    const deliveredGig = { ...gig, status: 'DELIVERED', gsi1pk: 'GIGS#DELIVERED', gsi1sk: createdAt, latestDeliveryVersion: version, updatedAt: createdAt };
    await db.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: table, Item: delivery, ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)' } },
      { Put: { TableName: table, Item: deliveredGig, ConditionExpression: '#status IN (:assigned, :delivered)', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':assigned': 'ASSIGNED', ':delivered': 'DELIVERED' } } }
    ] }));
    const reviewWindowEndsAt = await startReviewWindow(gig.gigId);
    await put({ pk: `GIG#${gig.gigId}`, sk: `STATUS_EVENT#${Date.now()}#${id()}`, type: 'GIG_STATUS_EVENT', gigId: gig.gigId, status: 'DELIVERED', previousStatus: gig.status, deliveryVersion: version, actorId: userId, createdAt });
    await enqueueNotification(gig.posterId, { notificationType: 'DELIVERY_SUBMITTED', title: 'Delivery submitted', message: `Delivery version ${version} is ready for review.`, data: { gigId: gig.gigId, deliveryVersion: version } });
    await broadcastEvent(gig.posterId, 'DELIVERY_SUBMITTED', { gigId: gig.gigId, deliveryVersion: version });
    const queueUrl = process.env.MALWARE_SCAN_QUEUE_URL || process.env.JOB_QUEUE_URL; if (queueUrl) await sqs.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify({ type: 'PROOF_REVIEW_REQUESTED', gigId: delivery.gigId, deliveryId: delivery.sk.replace('DELIVERY#', ''), files: delivery.files, brief: gig.description }) }));
    return json(201, { ...delivery, reviewWindowEndsAt });
  }
  const deliveriesPath = path.match(/^\/v1\/gigs\/([^/]+)\/deliveries$/);
  if (deliveriesPath && method === 'GET') {
    const gig = await get(`GIG#${deliveriesPath[1]}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND');
    if (![gig.posterId, gig.doerId].filter(Boolean).includes(userId) && !isAdmin(event)) return responseError(403, 'NOT_GIG_PARTICIPANT');
    const result = await db.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)', ExpressionAttributeValues: { ':pk': `GIG#${gig.gigId}`, ':prefix': 'DELIVERY#' }, ScanIndexForward: false }));
    return json(200, result.Items || []);
  }
  const reviewMatch = path.match(/^\/v1\/gigs\/([^/]+)\/review$/);
  if (reviewMatch && method === 'POST') {
    const gig = await get(`GIG#${reviewMatch[1]}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND');
    if (gig.posterId !== userId) return responseError(403, 'ONLY_POSTER');
    const review = { pk: `GIG#${reviewMatch[1]}`, sk: `PROOF_REVIEW#${id()}`, type: 'PROOF_REVIEW', gigId: reviewMatch[1], reviewerId: userId, verdict: input.verdict === 'ACCEPT' ? 'ACCEPT' : 'HUMAN_REVIEW', summary: input.summary || '', createdAt: now() };
    await put(review); await put({ pk: `AUDIT#${id()}`, sk: 'PROFILE', type: 'AUDIT_LOG', action: 'POSTER_PROOF_DECISION', subjectId: reviewMatch[1], actorId: userId, verdict: review.verdict, createdAt: now() }); return json(201, review);
  }
  const proofResult = path.match(/^\/v1\/gigs\/([^/]+)\/proof-review$/);
  if (proofResult && method === 'GET') {
    const cursor = pageKey(event.queryStringParameters?.nextToken); if (cursor === null) return responseError(400, 'INVALID_PAGE_TOKEN');
    const results = await db.send(new ScanCommand({ TableName: table, FilterExpression: '#type = :type AND payload.gigId = :gigId', ExpressionAttributeNames: { '#type': 'type' }, ExpressionAttributeValues: { ':type': 'PROOF_JOB', ':gigId': proofResult[1] }, ExclusiveStartKey: cursor, Limit: Math.min(Number(event.queryStringParameters?.limit || 20), 50) }));
    return json(200, { items: results.Items || [], nextToken: results.LastEvaluatedKey ? Buffer.from(JSON.stringify(results.LastEvaluatedKey)).toString('base64url') : null });
  }
  if (path === '/v1/admin/proof-review-queue' && method === 'GET') {
    if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED');
    const cursor = pageKey(event.queryStringParameters?.nextToken); if (cursor === null) return responseError(400, 'INVALID_PAGE_TOKEN');
    const queue = await db.send(new ScanCommand({ TableName: table, FilterExpression: '#type = :type AND #status IN (:pending, :assigned)', ExpressionAttributeNames: { '#type': 'type', '#status': 'status' }, ExpressionAttributeValues: { ':type': 'PROOF_JOB', ':pending': 'HUMAN_REVIEW', ':assigned': 'IN_HUMAN_REVIEW' }, ExclusiveStartKey: cursor, Limit: Math.min(Number(event.queryStringParameters?.limit || 50), 100) }));
    return json(200, { items: queue.Items || [], nextToken: queue.LastEvaluatedKey ? Buffer.from(JSON.stringify(queue.LastEvaluatedKey)).toString('base64url') : null });
  }
  const proofAssign = path.match(/^\/v1\/admin\/proof-review\/([^/]+)\/assign$/);
  if (proofAssign && method === 'POST') {
    if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED'); const item = await get(`PROOF_JOB#${proofAssign[1]}`, 'PROFILE'); if (!item) return responseError(404, 'PROOF_JOB_NOT_FOUND');
    if (item.status !== 'HUMAN_REVIEW') return responseError(409, 'PROOF_JOB_NOT_ASSIGNABLE'); const updated = { ...item, status: 'IN_HUMAN_REVIEW', assignedTo: input.assigneeId || userId, assignedBy: userId, assignedAt: now() };
    await db.send(new PutCommand({ TableName: table, Item: updated, ConditionExpression: '#status = :status', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':status': 'HUMAN_REVIEW' } })); await put(adminAuditRecord({ actorId: userId, action: 'PROOF_REVIEW_ASSIGNED', subjectId: proofAssign[1], requestId, before: { status: item.status, assignedTo: item.assignedTo || null }, after: { status: updated.status, assignedTo: updated.assignedTo }, metadata: {} })); return json(200, updated);
  }
  const proofResolve = path.match(/^\/v1\/admin\/proof-review\/([^/]+)$/);
  if (proofResolve && method === 'PATCH') { if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED'); const item = await get(`PROOF_JOB#${proofResolve[1]}`, 'PROFILE'); if (!item) return responseError(404, 'PROOF_JOB_NOT_FOUND'); if (!['HUMAN_REVIEW', 'IN_HUMAN_REVIEW', 'READY_FOR_POSTER'].includes(item.status)) return responseError(409, 'PROOF_JOB_NOT_RESOLVABLE'); const updated = { ...item, status: input.status === 'APPROVED' ? 'APPROVED' : 'REJECTED', resolvedBy: userId, resolution: String(input.notes || '').slice(0, 4000), resolvedAt: now() }; await db.send(new PutCommand({ TableName: table, Item: updated, ConditionExpression: '#status IN (:human, :assigned, :ready)', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':human': 'HUMAN_REVIEW', ':assigned': 'IN_HUMAN_REVIEW', ':ready': 'READY_FOR_POSTER' } })); await put(adminAuditRecord({ actorId: userId, action: 'PROOF_REVIEW_RESOLVED', subjectId: proofResolve[1], requestId, before: { status: item.status }, after: { status: updated.status }, metadata: { notes: updated.resolution } })); return json(200, updated, requestId); }
  const ratingMatch = path.match(/^\/v1\/gigs\/([^/]+)\/rating$/);
  if (ratingMatch && method === 'POST') {
    const gig = await get(`GIG#${ratingMatch[1]}`, 'PROFILE'); if (!gig) return responseError(404, 'GIG_NOT_FOUND');
    if (gig.status !== 'COMPLETED' || ![gig.posterId, gig.doerId].includes(userId)) return responseError(409, 'RATINGS_NOT_AVAILABLE');
    const stars = Number(input.stars); if (!Number.isInteger(stars) || stars < 1 || stars > 5) return responseError(400, 'stars must be 1-5');
    const revieweeId = userId === gig.posterId ? gig.doerId : gig.posterId; const revealAt = new Date(Date.now() + 172800000).toISOString(); const rating = { pk: `GIG#${gig.gigId}`, sk: `RATING#${userId}`, gsi2pk: 'RATING_REVEAL#PENDING', gsi2sk: `${revealAt}#${gig.gigId}#${userId}`, type: 'RATING', gigId: gig.gigId, reviewerId: userId, revieweeId, skill: input.skill || gig.skill, stars, tags: Array.isArray(input.tags) ? input.tags.slice(0, 10) : [], skillConfirmed: input.skillConfirmed === true, misrepresentedSkill: input.misrepresentedSkill === true && userId === gig.posterId, visible: false, createdAt: now(), revealAt };
    let saved; try { saved = await put(rating); } catch (error) { if (error.name === 'ConditionalCheckFailedException') return responseError(409, 'RATING_ALREADY_SUBMITTED'); throw error; }
    const counterpart = await get(`GIG#${gig.gigId}`, `RATING#${revieweeId}`);
    if (counterpart) {
      for (const item of [rating, counterpart]) {
        const delta = item.misrepresentedSkill ? -60 : item.stars === 5 ? 20 : item.stars === 4 ? 10 : item.stars === 3 ? 0 : item.stars === 2 ? -15 : -30;
        await applyCred(item.revieweeId, delta, 'DOUBLE_BLIND_GIG_RATING', { gigId: gig.gigId, ratingId: item.sk });
        await db.send(new UpdateCommand({ TableName: table, Key: { pk: `USER#${item.revieweeId}`, sk: `SKILL#${item.skill}` }, UpdateExpression: 'SET #type = :type, ratingSum = if_not_exists(ratingSum, :zero) + :stars, ratingCount = if_not_exists(ratingCount, :zero) + :one, updatedAt = :at', ExpressionAttributeNames: { '#type': 'type' }, ExpressionAttributeValues: { ':type': 'SKILL_RATING', ':zero': 0, ':stars': item.stars, ':one': 1, ':at': now() } }));
        if (item.misrepresentedSkill) await db.send(new UpdateCommand({ TableName: table, Key: { pk: `USER#${item.revieweeId}`, sk: `SKILL#${item.skill}` }, UpdateExpression: 'SET badgeStatus = :status, badgeRevokedAt = :at, badgeRevocationReason = :reason', ExpressionAttributeValues: { ':status': 'REVOKED', ':at': now(), ':reason': 'MISREPRESENTED_SKILL' } }));
      }
      await Promise.all([rating, counterpart].map((item) => db.send(new UpdateCommand({ TableName: table, Key: { pk: item.pk, sk: item.sk }, UpdateExpression: 'SET visible = :visible, revealedAt = :at REMOVE gsi2pk, gsi2sk', ExpressionAttributeValues: { ':visible': true, ':at': now() } }))));
      if (rating.misrepresentedSkill || counterpart.misrepresentedSkill) { const trustCaseId = id(); await put({ pk: `TRUST_CASE#${trustCaseId}`, sk: 'PROFILE', gsi1pk: 'TRUST_CASES', gsi1sk: now(), gsi2pk: 'TRUST_SENTINEL#MISREPRESENTED_SKILL', gsi2sk: `${now()}#${trustCaseId}`, type: 'TRUST_CASE', caseId: trustCaseId, subjectId: rating.misrepresentedSkill ? rating.revieweeId : counterpart.revieweeId, reason: 'MISREPRESENTED_SKILL', gigId: gig.gigId, status: 'OPEN', createdBy: userId, createdAt: now() }); }
    }
    return json(201, { ...saved, blind: !counterpart, visible: Boolean(counterpart) });
  }
  if (path === '/v1/admin/disputes' && method === 'GET') {
    const cursor = pageKey(event.queryStringParameters?.nextToken); if (cursor === null) return responseError(400, 'INVALID_PAGE_TOKEN');
    const result = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi1', KeyConditionExpression: 'gsi1pk = :pk', ExpressionAttributeValues: { ':pk': 'GIGS#DISPUTED' }, ExclusiveStartKey: cursor, ScanIndexForward: false, Limit: adminLimit(event.queryStringParameters?.limit) }));
    return json(200, { items: result.Items || [], nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url') : null }, requestId);
  }
  const assignIdentityReview = path.match(/^\/v1\/admin\/identity-reviews\/([^/]+)\/assign$/);
  if (assignIdentityReview && method === 'POST') { const review = await get(`IDENTITY_REVIEW#${assignIdentityReview[1]}`, 'PROFILE'); if (!review || review.status !== 'PENDING') return responseError(404, 'PENDING_IDENTITY_REVIEW_NOT_FOUND'); const updated = { ...review, assignedTo: input.assigneeId || userId, assignedBy: userId, assignedAt: now() }; await db.send(new PutCommand({ TableName: table, Item: updated, ConditionExpression: '#status = :status', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':status': 'PENDING' } })); await put(adminAuditRecord({ actorId: userId, action: 'IDENTITY_REVIEW_ASSIGNED', subjectId: review.userId, requestId, before: { assignedTo: review.assignedTo || null }, after: { assignedTo: updated.assignedTo }, metadata: { reviewId: review.reviewId } })); return json(200, updated, requestId); }
  const assignSkillReview = path.match(/^\/v1\/admin\/skill-reviews\/([^/]+)\/assign$/);
  if (assignSkillReview && method === 'POST') { const review = await get(`SKILL_REVIEW#${assignSkillReview[1]}`, 'PROFILE'); if (!review || review.status !== 'PENDING') return responseError(404, 'PENDING_SKILL_REVIEW_NOT_FOUND'); const updated = { ...review, assignedTo: input.assigneeId || userId, assignedBy: userId, assignedAt: now() }; await db.send(new PutCommand({ TableName: table, Item: updated, ConditionExpression: '#status = :status', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':status': 'PENDING' } })); await put(adminAuditRecord({ actorId: userId, action: 'SKILL_REVIEW_ASSIGNED', subjectId: review.userId, requestId, before: { assignedTo: review.assignedTo || null }, after: { assignedTo: updated.assignedTo }, metadata: { reviewId: review.reviewId } })); return json(200, updated, requestId); }
  const assignTrustCase = path.match(/^\/v1\/admin\/trust-cases\/([^/]+)\/assign$/);
  if (assignTrustCase && method === 'POST') { const current = await get(`TRUST_CASE#${assignTrustCase[1]}`, 'PROFILE'); if (!current || current.status !== 'OPEN') return responseError(404, 'OPEN_TRUST_CASE_NOT_FOUND'); const updated = { ...current, assignedTo: input.assigneeId || userId, assignedBy: userId, assignedAt: now() }; await db.send(new PutCommand({ TableName: table, Item: updated, ConditionExpression: '#status = :status', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':status': 'OPEN' } })); await put(adminAuditRecord({ actorId: userId, action: 'TRUST_CASE_ASSIGNED', subjectId: current.subjectId, requestId, before: { assignedTo: current.assignedTo || null }, after: { assignedTo: updated.assignedTo }, metadata: { caseId: current.caseId } })); return json(200, updated, requestId); }
  if (path === '/v1/admin/trust-cases' && method === 'POST') {
    if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED');
    if (input.reason === undefined || !input.subjectId) return responseError(400, 'subjectId and reason are required');
    const caseId = id(); const caseItem = { pk: `TRUST_CASE#${caseId}`, sk: 'PROFILE', gsi1pk: 'TRUST_CASES', gsi1sk: `${now()}#${caseId}`, ...(input.reason === 'MISREPRESENTED_SKILL' ? { gsi2pk: 'TRUST_SENTINEL#MISREPRESENTED_SKILL', gsi2sk: `${now()}#${caseId}` } : {}), type: 'TRUST_CASE', caseId, subjectId: input.subjectId, reason: input.reason, status: 'OPEN', createdBy: userId, createdAt: now() };
    const saved = await put(caseItem); await put(adminAuditRecord({ actorId: userId, action: 'TRUST_CASE_CREATED', subjectId: saved.subjectId, requestId, before: null, after: { status: saved.status }, metadata: { caseId: saved.caseId, reason: saved.reason } })); return json(201, saved);
  }
  if (path === '/v1/admin/identity-reviews' && method === 'GET') {
    if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED'); const status = String(event.queryStringParameters?.status || 'PENDING').toUpperCase(); const cursor = pageKey(event.queryStringParameters?.nextToken); if (cursor === null) return responseError(400, 'INVALID_PAGE_TOKEN');
    const result = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi1', KeyConditionExpression: 'gsi1pk = :pk', ExpressionAttributeValues: { ':pk': `IDENTITY_REVIEWS#${status}` }, ExclusiveStartKey: cursor, ScanIndexForward: true, Limit: Math.min(Number(event.queryStringParameters?.limit || 50), 100) }));
    return json(200, { items: result.Items || [], nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url') : null });
  }
  const identityReviewAction = path.match(/^\/v1\/admin\/identity-reviews\/([^/]+)\/(approve|reject)$/);
  if (identityReviewAction && method === 'POST') {
    if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED'); const review = await get(`IDENTITY_REVIEW#${identityReviewAction[1]}`, 'PROFILE'); if (!review || review.status !== 'PENDING') return responseError(404, 'PENDING_IDENTITY_REVIEW_NOT_FOUND');
    const action = identityReviewAction[2].toUpperCase(); if (input.confirmation !== `${action}:${review.reviewId}`) return responseError(400, 'CONFIRMATION_REQUIRED'); const profile = await get(`USER#${review.userId}`, 'PROFILE'); if (!profile || profile.identityStatus !== 'PENDING_MANUAL_REVIEW') return responseError(409, 'IDENTITY_REVIEW_STATE_CONFLICT');
    if (action === 'REJECT') { const rejectedProfile = { ...profile, identityStatus: 'REJECTED', identityReviewedBy: userId, identityReviewedAt: now(), identityRejectionReason: String(input.reason || '').slice(0, 1000), updatedAt: now() }; const rejectedReview = { ...review, status: 'REJECTED', gsi1pk: 'IDENTITY_REVIEWS#REJECTED', reviewedBy: userId, reviewedAt: now(), reason: rejectedProfile.identityRejectionReason }; await db.send(new TransactWriteCommand({ TransactItems: [{ Put: { TableName: table, Item: rejectedProfile, ConditionExpression: 'identityStatus = :pending', ExpressionAttributeValues: { ':pending': 'PENDING_MANUAL_REVIEW' } } }, { Put: { TableName: table, Item: rejectedReview, ConditionExpression: '#status = :pending', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':pending': 'PENDING' } } }] })); await put(adminAuditRecord({ actorId: userId, action: 'IDENTITY_REVIEW_REJECTED', subjectId: review.userId, requestId, before: { status: review.status }, after: { status: rejectedReview.status }, metadata: { reviewId: review.reviewId, reason: rejectedReview.reason } })); return json(200, { review: rejectedReview }); }
    const found = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi1', KeyConditionExpression: 'gsi1pk = :pk', ExpressionAttributeValues: { ':pk': `INVITE_CODE#${review.inviteCode}` }, Limit: 1 })); const invite = found.Items?.[0]; if (!invite || invite.status !== 'ISSUED') return responseError(409, 'INVITE_NO_LONGER_AVAILABLE');
    const parentPassport = await activePassportForUser(invite.inviterId); if (!parentPassport) return responseError(409, 'INVITER_PASSPORT_NOT_ACTIVE');
    const counter = await db.send(new UpdateCommand({ TableName: table, Key: { pk: 'SYSTEM', sk: 'PASSPORT_COUNTER' }, UpdateExpression: 'ADD #value :one', ExpressionAttributeNames: { '#value': 'value' }, ExpressionAttributeValues: { ':one': 1 }, ReturnValues: 'UPDATED_NEW' })); const passportNo = String(counter.Attributes.value).padStart(7, '0'); const issuedAt = now();
    const passport = { pk: `USER#${review.userId}`, sk: `PASSPORT#${passportNo}`, gsi1pk: `PASSPORT_NO#${passportNo}`, gsi1sk: review.userId, gsi2pk: `VOWCHER#${parentPassport.passportNo}`, gsi2sk: passportNo, gsi3pk: `SKILL#${profile.primarySkill}`, gsi3sk: '0500#' + review.userId, type: 'PASSPORT', userId: review.userId, passportNo, primarySkill: profile.primarySkill, vowchedBy: parentPassport.passportNo, generation: Number(parentPassport.generation || 0) + 1, lineage: [...(parentPassport.lineage || [parentPassport.passportNo]), passportNo], status: 'ACTIVE', cred: 500, issuedAt, chainHash: createHash('sha256').update(`${passportNo}:${review.userId}:${issuedAt}:${parentPassport.chainHash}`).digest('hex') };
    const { pendingInviteCode, ...activeProfileBase } = profile; const activeProfile = { ...activeProfileBase, onboardingComplete: true, identityStatus: 'VERIFIED_MANUALLY', identityReviewedBy: userId, identityReviewedAt: now(), passportNo, updatedAt: now() }; const approvedReview = { ...review, status: 'APPROVED', gsi1pk: 'IDENTITY_REVIEWS#APPROVED', reviewedBy: userId, reviewedAt: now(), passportNo };
    try { await db.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: table, Item: activeProfile, ConditionExpression: 'identityStatus = :pending', ExpressionAttributeValues: { ':pending': 'PENDING_MANUAL_REVIEW' } } },
      { Put: { TableName: table, Item: approvedReview, ConditionExpression: '#status = :pending', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':pending': 'PENDING' } } },
      { Update: { TableName: table, Key: { pk: invite.pk, sk: invite.sk }, UpdateExpression: 'SET #status = :redeemed, redeemedBy = :userId, redeemedAt = :at', ConditionExpression: '#status = :issued', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':redeemed': 'REDEEMED', ':issued': 'ISSUED', ':userId': review.userId, ':at': now() } } },
      { Put: { TableName: table, Item: passport, ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)' } },
      { Update: { TableName: table, Key: { pk: `USER#${invite.inviterId}`, sk: 'PROFILE' }, UpdateExpression: 'ADD referralsRedeemed :one SET lastReferralAt = :at', ConditionExpression: 'attribute_exists(pk)', ExpressionAttributeValues: { ':one': 1, ':at': now() } } }
    ] })); } catch (error) { return responseError(error.name === 'TransactionCanceledException' ? 409 : 500, error.name === 'TransactionCanceledException' ? 'IDENTITY_APPROVAL_CONFLICT' : 'IDENTITY_APPROVAL_FAILED'); }
    await enqueueNotification(invite.inviterId, { notificationType: 'INVITE_REDEEMED', title: 'Your Vowch was verified', message: `${profile.displayName} joined your House.`, data: { passportNo } });
    await emitEvent('passport.minted', { userId: review.userId, passportNo, inviterId: invite.inviterId }); await put(adminAuditRecord({ actorId: userId, action: 'IDENTITY_REVIEW_APPROVED', subjectId: review.userId, requestId, before: { status: review.status }, after: { status: approvedReview.status, passportNo }, metadata: { reviewId: review.reviewId } })); return json(201, { review: approvedReview, passport, user: activeProfile });
  }
  if (path === '/v1/admin/skill-reviews' && method === 'GET') { if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED'); const result = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi1', KeyConditionExpression: 'gsi1pk = :pk', ExpressionAttributeValues: { ':pk': 'SKILL_REVIEWS#PENDING' }, Limit: 100 })); return json(200, result.Items || []); }
  const skillReviewAction = path.match(/^\/v1\/admin\/skill-reviews\/([^/]+)\/(approve|reject)$/);
  if (skillReviewAction && method === 'POST') { if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED'); const review = await get(`SKILL_REVIEW#${skillReviewAction[1]}`, 'PROFILE'); if (!review || review.status !== 'PENDING') return responseError(404, 'PENDING_SKILL_REVIEW_NOT_FOUND'); const action = skillReviewAction[2].toUpperCase(); if (input.confirmation !== `${action}:${review.reviewId}`) return responseError(400, 'CONFIRMATION_REQUIRED'); const badgeStatus = action === 'APPROVE' ? 'VERIFIED' : 'REJECTED'; const updated = { ...review, status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED', gsi1pk: `SKILL_REVIEWS#${action === 'APPROVE' ? 'APPROVED' : 'REJECTED'}`, reviewedBy: userId, reviewedAt: now() }; const skill = { pk: `USER#${review.userId}`, sk: `SKILL#${review.skill}`, type: 'SKILL_RATING', userId: review.userId, skill: review.skill, badgeStatus, verifiedAt: action === 'APPROVE' ? now() : null, verifiedBy: userId, ratingSum: 0, ratingCount: 0, updatedAt: now() }; await db.send(new TransactWriteCommand({ TransactItems: [{ Put: { TableName: table, Item: skill } }, { Put: { TableName: table, Item: updated, ConditionExpression: '#status = :pending', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':pending': 'PENDING' } } }] })); await put(adminAuditRecord({ actorId: userId, action: action === 'APPROVE' ? 'SKILL_REVIEW_APPROVED' : 'SKILL_REVIEW_REJECTED', subjectId: review.userId, requestId, before: { status: review.status }, after: { status: updated.status, badgeStatus }, metadata: { reviewId: review.reviewId, skill: review.skill } })); return json(200, { review: updated, skill }); }
  if (path === '/v1/admin/trust-cases' && method === 'GET') {
    if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED');
    const cursor = pageKey(event.queryStringParameters?.nextToken); if (cursor === null) return responseError(400, 'INVALID_PAGE_TOKEN'); const values = { ':pk': 'TRUST_CASES' }; const names = {}; const filters = [];
    if (event.queryStringParameters?.status) { filters.push('#status = :status'); names['#status'] = 'status'; values[':status'] = event.queryStringParameters.status; }
    if (event.queryStringParameters?.subjectId) { filters.push('subjectId = :subjectId'); values[':subjectId'] = event.queryStringParameters.subjectId; }
    const result = await db.send(new QueryCommand({ TableName: table, IndexName: 'gsi1', KeyConditionExpression: 'gsi1pk = :pk', FilterExpression: filters.join(' AND ') || undefined, ExpressionAttributeNames: Object.keys(names).length ? names : undefined, ExpressionAttributeValues: values, ExclusiveStartKey: cursor, ScanIndexForward: false, Limit: Math.min(Number(event.queryStringParameters?.limit || 50), 100) }));
    return json(200, { items: result.Items || [], nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url') : null });
  }
  const suspendUser = path.match(/^\/v1\/admin\/users\/([^/]+)\/suspend$/);
  if (suspendUser && method === 'PATCH') {
    if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED');
    const profile = await get(`USER#${suspendUser[1]}`, 'PROFILE'); if (!profile) return responseError(404, 'USER_NOT_FOUND');
    const nextStatus = input.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED'; if (input.confirmation !== `${nextStatus}:${suspendUser[1]}`) return responseError(400, 'CONFIRMATION_REQUIRED');
    const updated = { ...profile, accountStatus: nextStatus, moderationReason: input.reason || '', moderatedBy: userId, moderatedAt: now() };
    await db.send(new PutCommand({ TableName: table, Item: updated }));
    await put(adminAuditRecord({ actorId: userId, action: updated.accountStatus === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REINSTATED', subjectId: suspendUser[1], requestId, before: { accountStatus: profile.accountStatus || 'ACTIVE' }, after: { accountStatus: updated.accountStatus }, metadata: { reason: updated.moderationReason } }));
    return json(200, updated);
  }
  const revokePassport = path.match(/^\/v1\/admin\/passports\/([^/]+)\/revoke$/);
  if (revokePassport && method === 'PATCH') {
    if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED');
    const passport = await passportByNumber(revokePassport[1]); if (!passport) return responseError(404, 'PASSPORT_NOT_FOUND'); if (input.confirmation !== `REVOKE:${passport.passportNo}`) return responseError(400, 'CONFIRMATION_REQUIRED');
    const updated = { ...passport, status: 'REVOKED', revocationReason: input.reason || '', revokedBy: userId, revokedAt: now() };
    await db.send(new PutCommand({ TableName: table, Item: updated }));
    const branch = await houseTree(passport); const orphans = branch.nodes.slice(1).filter((item) => item.status === 'ACTIVE');
    for (const descendant of orphans) await db.send(new PutCommand({ TableName: table, Item: { ...descendant, lineageStatus: 'ORPHANED', orphanedByPassportNo: passport.passportNo, orphanedAt: now() } }));
    await put(adminAuditRecord({ actorId: userId, action: 'PASSPORT_REVOKED', subjectId: passport.userId, requestId, before: { passportNo: passport.passportNo, status: passport.status }, after: { passportNo: updated.passportNo, status: updated.status }, metadata: { reason: updated.revocationReason, orphanedDescendants: orphans.length } }));
    return json(200, { passport: updated, orphanedDescendants: orphans.length, treeTruncated: branch.truncated });
  }
  const adminBranch = path.match(/^\/v1\/admin\/passports\/([^/]+)\/branch$/);
  if (adminBranch && method === 'GET') { if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED'); const passport = await passportByNumber(adminBranch[1]); if (!passport) return responseError(404, 'PASSPORT_NOT_FOUND'); const tree = await houseTree(passport); return json(200, { root: treeNode(passport), nodes: tree.nodes.map(treeNode), edges: tree.edges, truncated: tree.truncated }); }
  if (path === '/v1/admin/orphans' && method === 'GET') { if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED'); const cursor = pageKey(event.queryStringParameters?.nextToken); if (cursor === null) return responseError(400, 'INVALID_PAGE_TOKEN'); const result = await db.send(new ScanCommand({ TableName: table, FilterExpression: '#type = :type AND lineageStatus = :status', ExpressionAttributeNames: { '#type': 'type' }, ExpressionAttributeValues: { ':type': 'PASSPORT', ':status': 'ORPHANED' }, ExclusiveStartKey: cursor, Limit: Math.min(Number(event.queryStringParameters?.limit || 50), 100) })); return json(200, { items: result.Items || [], nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url') : null }); }
  const resolveOrphan = path.match(/^\/v1\/admin\/orphans\/([^/]+)$/);
  if (resolveOrphan && method === 'PATCH') { if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED'); const passport = await passportByNumber(resolveOrphan[1]); if (!passport || passport.lineageStatus !== 'ORPHANED') return responseError(404, 'ORPHAN_NOT_FOUND'); if (input.confirmation !== `RESOLVE_ORPHAN:${passport.passportNo}`) return responseError(400, 'CONFIRMATION_REQUIRED'); const updated = { ...passport, orphanReviewStatus: input.action === 'SUSPEND' ? 'SUSPENDED_PENDING_REISSUE' : 'REVIEWED', orphanResolvedBy: userId, orphanResolvedAt: now(), orphanResolution: String(input.notes || '').slice(0, 2000) }; await db.send(new PutCommand({ TableName: table, Item: updated })); await put(adminAuditRecord({ actorId: userId, action: 'ORPHAN_RESOLVED', subjectId: passport.userId, requestId, before: { reviewStatus: passport.orphanReviewStatus || null }, after: { reviewStatus: updated.orphanReviewStatus }, metadata: { passportNo: passport.passportNo, notes: updated.orphanResolution } })); return json(200, updated); }
  const verifyPoster = path.match(/^\/v1\/admin\/posters\/([^/]+)\/verification$/);
  if (verifyPoster && method === 'PATCH') { if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED'); const profile = await get(`USER#${verifyPoster[1]}`, 'PROFILE'); if (!profile) return responseError(404, 'POSTER_NOT_FOUND'); const status = input.status === 'VERIFIED' ? 'VERIFIED' : 'REJECTED'; if (input.confirmation !== `${status}:${verifyPoster[1]}`) return responseError(400, 'CONFIRMATION_REQUIRED'); const updated = { ...profile, posterVerificationStatus: status, posterVerificationReason: String(input.reason || '').slice(0, 1000), posterVerifiedBy: userId, posterVerifiedAt: now(), updatedAt: now() }; await db.send(new PutCommand({ TableName: table, Item: updated })); await put(adminAuditRecord({ actorId: userId, action: 'POSTER_VERIFICATION_UPDATED', subjectId: profile.userId, requestId, before: { status: profile.posterVerificationStatus || 'UNVERIFIED' }, after: { status }, metadata: { reason: updated.posterVerificationReason } })); return json(200, { userId: updated.userId, status, verifiedAt: updated.posterVerifiedAt }); }
  const resolveDispute = path.match(/^\/v1\/admin\/gigs\/([^/]+)\/dispute$/);
  if (resolveDispute && method === 'POST') {
    if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED');
    if (!['RELEASE', 'REFUND', 'SPLIT'].includes(input.outcome)) return responseError(400, 'outcome must be RELEASE, REFUND, or SPLIT');
    if (input.outcome === 'SPLIT' && (!Array.isArray(input.transfers) || input.transfers.length === 0 || input.transfers.some((transfer) => !transfer.account || !Number.isInteger(transfer.amount) || transfer.amount < 1))) return responseError(400, 'valid transfers are required for SPLIT');
    if (input.outcome === 'SPLIT' && input.transfers.reduce((sum, transfer) => sum + transfer.amount, 0) !== Number(input.totalAmountPaise)) return responseError(400, 'split amounts must equal totalAmountPaise');
    const gig = await get(`GIG#${resolveDispute[1]}`, 'PROFILE'); if (!gig || gig.status !== 'DISPUTED') return responseError(404, 'DISPUTED_GIG_NOT_FOUND');
    const updatedGig = { ...gig, status: 'RESOLVED', disputeOutcome: input.outcome, disputeResolution: input.notes || '', resolvedBy: userId, resolvedAt: now() };
    await db.send(new PutCommand({ TableName: table, Item: updatedGig, ConditionExpression: '#status = :disputed', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':disputed': 'DISPUTED' } }));
    const payments = await db.send(new ScanCommand({ TableName: table, FilterExpression: '#type = :type AND gigId = :gigId', ExpressionAttributeNames: { '#type': 'type' }, ExpressionAttributeValues: { ':type': 'ESCROW_ORDER', ':gigId': gig.gigId } }));
    for (const payment of payments.Items || []) { let providerResult = null; if (payment.providerPaymentId) { if (input.outcome === 'REFUND') providerResult = await refundPayment(payment.providerPaymentId, payment.amountPaise, { gigId: gig.gigId, dispute: true }, `dispute-refund-${payment.orderId}`); else if (input.outcome === 'RELEASE' && payment.razorpayAccountId) providerResult = await releaseTransfer(payment.providerPaymentId, payment.razorpayAccountId, payment.amountPaise, { gigId: gig.gigId, dispute: true }, `dispute-release-${payment.orderId}`); else if (input.outcome === 'SPLIT' && input.transfers) providerResult = await splitTransfer(payment.providerPaymentId, input.transfers, `dispute-split-${payment.orderId}`); } const status = providerResult ? (input.outcome === 'REFUND' ? 'REFUNDED' : 'RELEASED') : input.outcome === 'REFUND' ? 'REFUND_REQUESTED' : input.outcome === 'RELEASE' ? 'RELEASE_REQUESTED' : 'SPLIT_REVIEW'; await db.send(new PutCommand({ TableName: table, Item: { ...payment, status, disputeOutcome: input.outcome, providerResult, updatedAt: now() } })); }
    await put(adminAuditRecord({ actorId: userId, action: 'DISPUTE_RESOLVED', subjectId: gig.gigId, requestId, before: { status: gig.status }, after: { status: updatedGig.status }, metadata: { outcome: input.outcome, notes: updatedGig.disputeResolution } }));
    return json(200, { gig: updatedGig, outcome: input.outcome });
  }
  const resolveCase = path.match(/^\/v1\/admin\/trust-cases\/([^/]+)$/);
  if (resolveCase && method === 'PATCH') {
    if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED');
    const current = await get(`TRUST_CASE#${resolveCase[1]}`, 'PROFILE'); if (!current) return responseError(404, 'CASE_NOT_FOUND');
    if (input.confirmation !== `RESOLVE_CASE:${current.caseId}`) return responseError(400, 'CONFIRMATION_REQUIRED');
    const confirmedMisconduct = input.confirmedMisconduct === true && ['FRAUD', 'REPEATED_SERIOUS_MISCONDUCT'].includes(String(input.finding || '')); const subjectPassport = await activePassportForUser(current.subjectId);
    const cascade = confirmedMisconduct && subjectPassport ? await applyConfirmedVowchPenalty(subjectPassport.passportNo, current.caseId) : [];
    const updated = { ...current, status: input.status || 'RESOLVED', resolution: input.resolution || '', confirmedMisconduct, cascade, resolvedBy: userId, resolvedAt: now() };
    await db.send(new PutCommand({ TableName: table, Item: updated })); await put(adminAuditRecord({ actorId: userId, action: 'TRUST_CASE_RESOLVED', subjectId: current.subjectId, requestId, before: { status: current.status }, after: { status: updated.status }, metadata: { caseId: current.caseId, confirmedMisconduct, cascadeCount: cascade.length, resolution: updated.resolution } })); return json(200, updated);
  }
  if (path === '/v1/admin/audit-logs' && method === 'GET') {
    if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED'); const cursor = pageKey(event.queryStringParameters?.nextToken); if (cursor === null) return responseError(400, 'INVALID_PAGE_TOKEN');
    const values = { ':type': 'AUDIT_LOG' }; const filters = ['#type = :type']; const names = { '#type': 'type' };
    if (event.queryStringParameters?.action) { filters.push('#action = :action'); names['#action'] = 'action'; values[':action'] = event.queryStringParameters.action; }
    if (event.queryStringParameters?.subjectId) { filters.push('subjectId = :subjectId'); values[':subjectId'] = event.queryStringParameters.subjectId; }
    const result = await db.send(new ScanCommand({ TableName: table, FilterExpression: filters.join(' AND '), ExpressionAttributeNames: names, ExpressionAttributeValues: values, ExclusiveStartKey: cursor, Limit: Math.min(Number(event.queryStringParameters?.limit || 50), 100) }));
    return json(200, { items: result.Items || [], nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url') : null });
  }
  if (path === '/v1/admin/notification-delivery' && method === 'GET') {
    if (!isAdmin(event)) return responseError(403, 'ADMIN_REQUIRED'); const cursor = pageKey(event.queryStringParameters?.nextToken); if (cursor === null) return responseError(400, 'INVALID_PAGE_TOKEN');
    const result = await db.send(new ScanCommand({ TableName: table, FilterExpression: '#type = :type', ExpressionAttributeNames: { '#type': 'type' }, ExpressionAttributeValues: { ':type': 'NOTIFICATION_DELIVERY_FAILURE' }, ExclusiveStartKey: cursor, Limit: Math.min(Number(event.queryStringParameters?.limit || 50), 100) }));
    const items = result.Items || []; return json(200, { items, pending: items.filter((item) => !item.deliveryStatus).length, sent: items.filter((item) => item.deliveryStatus === 'SENT').length, skipped: items.filter((item) => item.deliveryStatus === 'SKIPPED').length, nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url') : null });
  }
  return responseError(404, 'NOT_FOUND');
};
