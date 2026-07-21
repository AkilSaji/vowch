# Vowch — trusted gig-work marketplace

Vowch is a marketplace for skilled gig work built around trust. Clients can post
gigs, and workers use a Skill Passport, referrals ("vouches"), reputation, and
QR verification to help make sure the right person completes the work.

This repository contains the Vowch web portals, mobile app, serverless backend,
infrastructure, and deployment workflow.

## Project structure

- `apps/client-portal/` — client-facing web portal for posting and managing gigs
- `apps/admin-portal/` — administrator portal
- `apps/mobile/` — Expo / React Native mobile app for workers
- `backend/` — AWS SAM serverless API and worker services
- `infra/` — CloudFormation bootstrap and security stacks

## Built with Codex and GPT-5.6

Vowch was built during OpenAI Build Week with Codex using GPT-5.6. Codex was used
as a development partner to turn the product architecture into working web,
mobile, backend, and infrastructure code; iterate on user flows and interface
details; help integrate AWS, Cognito, Mapbox, Expo, and Vercel; and validate and
refine the implementation. The product decisions, testing, and final integration
were directed by the builder.

## Backend and infrastructure

The serverless backend is implemented with AWS SAM application code in
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
