import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { releaseTransfer } from './payments.mjs';
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
export const handler = async () => {
  const now = new Date(); let lastKey; let released = 0;
  do {
    const page = await db.send(new QueryCommand({ TableName: process.env.TABLE_NAME, IndexName: 'gsi2', KeyConditionExpression: 'gsi2pk = :pk AND gsi2sk <= :now', ExpressionAttributeValues: { ':pk': 'PAYMENT_STATUS#CAPTURED', ':now': `${now.toISOString()}\uffff` }, ExclusiveStartKey: lastKey }));
    for (const payment of page.Items || []) {
      try {
        if (!payment.providerPaymentId || !payment.razorpayAccountId) throw new Error('PAYOUT_DETAILS_MISSING');
        const providerResult = await releaseTransfer(payment.providerPaymentId, payment.razorpayAccountId, payment.amountPaise, { gigId: payment.gigId, autoReleased: true }, `auto-release-${payment.orderId}`);
        const settledAt = now.toISOString(); await db.send(new UpdateCommand({ TableName: process.env.TABLE_NAME, Key: { pk: payment.pk, sk: payment.sk }, UpdateExpression: 'SET #status = :next, autoReleased = :true, providerResult = :provider, settlementOperation = :operation, settlementCompletedAt = :now, gsi2pk = :settled, gsi2sk = :settledAt, gsi4pk = :earnings, gsi4sk = :now', ConditionExpression: '#status = :current', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':next': 'RELEASED', ':current': 'CAPTURED', ':true': true, ':provider': providerResult, ':operation': 'AUTO_RELEASE', ':settled': 'PAYMENT_STATUS#RELEASED', ':settledAt': `${settledAt}#${payment.orderId}`, ':earnings': `EARNINGS#${payment.doerId}`, ':now': settledAt } }));
        await db.send(new PutCommand({ TableName: process.env.TABLE_NAME, Item: { pk: `PAYMENT_LEDGER#${payment.orderId}`, sk: `${Date.now()}#AUTO_RELEASE`, type: 'PAYMENT_LEDGER_EVENT', orderId: payment.orderId, event: 'RELEASED', automatic: true, createdAt: now.toISOString() } })); released += 1;
      } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') continue;
        const retryAt = now.toISOString(); await db.send(new UpdateCommand({ TableName: process.env.TABLE_NAME, Key: { pk: payment.pk, sk: payment.sk }, UpdateExpression: 'SET #status = :status, gsi2pk = :gsi2pk, gsi2sk = :gsi2sk, gsi3sk = :gsi3sk, providerRetryCount = if_not_exists(providerRetryCount, :zero) + :one, lastProviderError = :error, updatedAt = :now', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':status': 'RELEASE_RETRY_REQUIRED', ':gsi2pk': 'PAYMENT_STATUS#RELEASE_RETRY_REQUIRED', ':gsi2sk': `${retryAt}#${payment.orderId}`, ':gsi3sk': `RELEASE_RETRY_REQUIRED#${retryAt}#${payment.orderId}`, ':zero': 0, ':one': 1, ':error': String(error.message || error).slice(0, 1000), ':now': retryAt } }));
        await db.send(new PutCommand({ TableName: process.env.TABLE_NAME, Item: { pk: `PAYMENT_RETRY#${payment.orderId}`, sk: `${Date.now()}#AUTO_RELEASE`, type: 'PAYMENT_RETRY', orderId: payment.orderId, operation: 'AUTO_RELEASE', error: String(error.message || error).slice(0, 1000), createdAt: now.toISOString() } }));
      }
    }
    lastKey = page.LastEvaluatedKey;
  } while (lastKey);
  return { released };
};
