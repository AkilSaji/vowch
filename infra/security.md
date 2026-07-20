# Secure upload infrastructure

Deploy `security.yaml` after the bootstrap stack. It creates the quarantine bucket, malware scan queues, clean-file queue, proof-review queue, dead-letter queues, security SNS topic, and scan alarm.

Malware scanning is intentionally deferred. The upload bucket remains private and encrypted; ClamAV can be added later as a separate production hardening stack.

```bash
sam deploy --template-file infra/security.yaml --stack-name vowch-security-dev --capabilities CAPABILITY_IAM
```
