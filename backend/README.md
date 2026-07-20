# Vowch backend

This is the single-environment AWS SAM backend for Vowch. It deliberately has no VPC, subnets, security groups, NAT gateways, or always-on servers. Deploy through `.github/workflows/deploy-full-vowch.yml`; it provisions bootstrap secrets, upload security infrastructure, the SAM application stack, and the worker-index backfill as one deployment path.

## Local checks

```bash
node --check src/app.mjs
sam validate --template-file template.yaml
sam build --template-file template.yaml
sam deploy --config-file samconfig.toml
```

The deployed API includes onboarding and passport chains, invites and waitlist, gigs and matching, escrow orders and settlement, delivery/proof review, ratings, notifications/realtime delivery, communities, moderation, and admin operations. The OpenAPI contract is in `openapi.yaml`.

## AWS resources

- HTTP API Gateway
- Lambda on arm64 Node.js 20
- DynamoDB on-demand with point-in-time recovery
- Encrypted private S3 upload bucket
- SQS job queue
- Cognito user pool and app client
- API Gateway WebSocket API for live status events
- Scheduled settlement, expiry, ratings, notification, and Trust Sentinel workers
- Malware-scan queue and dead-letter alarms

All resource names are generated from the single `Environment` parameter (`dev` by default). Add `AWS_DEPLOY_ROLE_ARN` and `AWS_REGION` as GitHub Actions secrets; the workflow uses OIDC rather than long-lived AWS keys.
