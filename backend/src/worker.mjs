import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import pdf from 'pdf-parse';
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const ssm = new SSMClient({}); const config = new Map();
async function secret(name, fallback = '') { if (config.has(name)) return config.get(name); try { const result = await ssm.send(new GetParameterCommand({ Name: `${process.env.SSM_PREFIX || ''}/${name}`, WithDecryption: true })); const value = result.Parameter?.Value || fallback; config.set(name, value); return value; } catch { return fallback; } }
async function extractDeliveryFile(file) {
  const key = file.key || file; const declaredType = file.contentType || '';
  if (!key.startsWith('members/')) throw new Error('INVALID_UPLOAD_KEY');
  const head = await s3.send(new HeadObjectCommand({ Bucket: process.env.UPLOAD_BUCKET, Key: key }));
  if (Number(head.ContentLength || 0) > 25 * 1024 * 1024) throw new Error('UPLOAD_TOO_LARGE');
  if (file.checksumSha256 && head.ChecksumSHA256 && file.checksumSha256 !== head.ChecksumSHA256) throw new Error('UPLOAD_CHECKSUM_MISMATCH');
  const contentType = head.ContentType || declaredType;
  if (contentType?.startsWith('image/')) { const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.UPLOAD_BUCKET, Key: key }), { expiresIn: 600 }); return { content: { type: 'input_image', image_url: url }, metadata: { key, contentType, bytes: head.ContentLength, checksumVerified: Boolean(head.ChecksumSHA256), extraction: 'IMAGE' } }; }
  const object = await s3.send(new GetObjectCommand({ Bucket: process.env.UPLOAD_BUCKET, Key: key })); const bytes = Buffer.from(await object.Body.transformToByteArray());
  if (contentType === 'application/pdf') { const parsed = await pdf(bytes); const text = String(parsed.text || '').replace(/\s+/g, ' ').slice(0, 12000); return { content: { type: 'input_text', text: `PDF delivery (${key}): ${text || '[No extractable text]'}` }, metadata: { key, contentType, bytes: head.ContentLength, checksumVerified: Boolean(head.ChecksumSHA256), extraction: 'PDF_TEXT', characters: text.length } }; }
  if (contentType?.startsWith('text/') || ['application/json', 'text/csv'].includes(contentType)) { const text = bytes.toString('utf8').replace(/\0/g, '').slice(0, 12000); return { content: { type: 'input_text', text: `Text delivery (${key}): ${text}` }, metadata: { key, contentType, bytes: head.ContentLength, checksumVerified: Boolean(head.ChecksumSHA256), extraction: 'TEXT', characters: text.length } }; }
  return { content: { type: 'input_text', text: `Unsupported delivery type (${contentType || 'unknown'}) for ${key}; route to human review.` }, metadata: { key, contentType, bytes: head.ContentLength, checksumVerified: Boolean(head.ChecksumSHA256), extraction: 'UNSUPPORTED' } };
}
export const proofReview = async (event) => {
  const failures = [];
  for (const record of event.Records || []) {
    try {
      const payload = JSON.parse(record.body);
      let status = 'HUMAN_REVIEW'; let summary = 'AI review is not configured.'; let extracted = []; let securityFlags = [];
      extracted = await Promise.all((payload.files || []).slice(0, 5).map(extractDeliveryFile));
      if ((payload.files || []).some((file) => file.malwareStatus !== 'CLEAN')) securityFlags.push('MALWARE_SCAN_NOT_CLEAN');
      const groqKey = await secret('groq/api-key', process.env.GROQ_API_KEY);
      if ((payload.files || []).some((file) => (file.contentType || '').startsWith('image/'))) securityFlags.push('IMAGE_REQUIRES_HUMAN_REVIEW_WITH_TEXT_ONLY_GROQ_MODEL');
      if (groqKey && securityFlags.length === 0) {
        const fileInputs = extracted.filter((item) => item.content.type === 'input_text').map((item) => item.content);
        const response = await fetch('https://api.groq.com/openai/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', input: [{ role: 'user', content: [{ type: 'input_text', text: `Review this delivery against the brief. Do not judge subjective taste. Confirm whether files exist, summarize visible deliverables, identify missing or mismatched items, and route uncertainty to human review. Brief: ${payload.brief || ''}` }, ...fileInputs] }], text: { format: { type: 'json_schema', name: 'proof_review', strict: true, schema: { type: 'object', properties: { status: { type: 'string', enum: ['READY_FOR_POSTER', 'HUMAN_REVIEW'] }, summary: { type: 'string' }, flags: { type: 'array', items: { type: 'string' } }, confidence: { type: 'number' } }, required: ['status', 'summary', 'flags', 'confidence'], additionalProperties: false } } } }) });
        if (response.ok) { const result = await response.json(); const text = result.output_text || ''; try { const review = JSON.parse(text); status = review.status; summary = JSON.stringify(review); } catch { status = 'HUMAN_REVIEW'; summary = 'Structured AI response could not be parsed.'; } }
      }
      if (securityFlags.length) summary = 'Files require human review because malware scanning is not marked CLEAN.';
      await db.send(new PutCommand({ TableName: process.env.TABLE_NAME, Item: { pk: `PROOF_JOB#${record.messageId}`, sk: 'PROFILE', type: 'PROOF_JOB', payload, status, summary, extraction: extracted.map((item) => item.metadata), securityFlags, createdAt: new Date().toISOString() } }));
    } catch { failures.push({ itemIdentifier: record.messageId }); }
  }
  return { batchItemFailures: failures };
};
