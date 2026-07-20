# Vowch backend deployment

## GitHub Actions configuration

Create the following repository secrets before enabling the production features:

- `AWS_DEPLOY_ROLE_ARN` — the `GitHubDeployRoleArn` output from the bootstrap stack.
- `GROQ_API_KEY` — Groq API key used by proof review.
- `GMAIL_SMTP_USER` and `GMAIL_APP_PASSWORD` — email OTP and notification delivery.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `PAYMENT_WEBHOOK_SECRET` — escrow payments.
- `MALWARE_SCAN_URL` and `MALWARE_SCAN_TOKEN` — private antivirus scanner; required before accepting delivered files.
- `PUSH_GATEWAY_URL` and `PUSH_GATEWAY_TOKEN` — optional FCM/APNs gateway.

Create these non-secret repository variables:

- `AWS_REGION` — for example, `ap-south-1`.
- `PUBLIC_APP_ORIGIN` — exact public portal origin, such as `https://app.example.com`.
- `GROQ_MODEL` — `llama-3.3-70b-versatile`; leaving it unset uses that default.
- `ALERT_EMAIL` — recommended recipient for deployment alarms; confirm the SNS email subscription.

The deploy role trusts GitHub Actions through OIDC. Do not create or store long-lived AWS access keys in GitHub.

## Runtime secrets

The application stack receives Groq, Razorpay, and webhook credentials as
`NoEcho` CloudFormation parameters from GitHub Actions secrets. Lambda encrypts
environment variables at rest with the AWS managed key by default. Runtime code
also supports encrypted SSM parameters under `SsmPrefix` if you later choose to
manage secret rotation outside the deployment workflow.

The text-only proof-review model is configurable through `GROQ_MODEL`; its
current default is `llama-3.3-70b-versatile`.

The backend deploy fails closed for delivery uploads until `MALWARE_SCAN_URL` is configured. This is intentional: files are never released to proof review without a clean scan result.

## Gmail SMTP for hackathon OTP and notifications

Set GitHub secrets `GMAIL_SMTP_USER` and `GMAIL_APP_PASSWORD`. The latter must be a Google App Password, not the Gmail account password. Cognito continues to own custom-challenge authentication; Nodemailer only delivers the emailed code.

## Deploy

Push to `main`. The workflow installs dependencies, runs tests, validates/builds
SAM, deploys the `vowch-dev` stack, calls the deployed `/health` endpoint, and
backfills worker query indexes.

It then runs `migrate:worker-indexes`; this is safe to rerun and is required before query-driven scheduled workers can process legacy records. The application outputs are `ApiUrl`, `RealtimeWebSocketUrl`, `TableName`, `UploadBucketName`, `UserPoolId`, and `UserPoolClientId`.

## Founder seed

After the first deployment:

```bash
$env:TABLE_NAME='vowch-dev'
$env:FOUNDER_USER_ID='cognito-user-id'
npm run seed:founder
```

Run migrations after schema/index changes:

```bash
$env:TABLE_NAME='vowch-dev'
npm run migrate
npm run migrate:worker-indexes
```
