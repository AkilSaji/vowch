# Vowch infrastructure bootstrap

Deploy `bootstrap.yaml` once before the application stack. It creates the SNS
alert topic and GitHub OIDC deployment role. Application credentials stay in
GitHub Actions secrets and are supplied to the SAM stack as `NoEcho`
CloudFormation parameters; this avoids attempting to create unsupported SSM
`SecureString` resources from CloudFormation.

```bash
aws cloudformation deploy \
  --template-file infra/bootstrap.yaml \
  --stack-name vowch-bootstrap-dev \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Environment=dev \
    GitHubOrg=your-org \
    GitHubRepo=your-repo
```

Use the `GitHubDeployRoleArn` output as the `AWS_DEPLOY_ROLE_ARN` GitHub secret.
`AlertTopicArn` is the alarm-notification topic. Confirm the SNS email
subscription before relying on alerts.
