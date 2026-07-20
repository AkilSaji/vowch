# Vowch backend and infrastructure

This repository deploys the Vowch serverless backend: AWS SAM application code in
`backend/`, CloudFormation bootstrap and security stacks in `infra/`, and the
GitHub Actions deployment workflow in `.github/workflows/`.

The stack uses API Gateway, Lambda, DynamoDB, Cognito, SQS, EventBridge,
WebSockets, and a private S3 upload bucket. GitHub Actions authenticates to AWS
through OIDC; no AWS access key or secret key is stored in GitHub.

## Deployment

Before the first GitHub Actions deployment, deploy `infra/bootstrap.yaml` once
with an administrator AWS session and copy the resulting `GitHubDeployRoleArn`
CloudFormation output into the `AWS_DEPLOY_ROLE_ARN` GitHub Actions secret.
Then configure the repository secrets and variables listed in
`backend/deployment.md` and push to `main`.

For local validation:

```bash
npm ci --prefix backend
npm test --prefix backend
npm run lint --prefix backend
sam validate --template-file backend/template.yaml
```
