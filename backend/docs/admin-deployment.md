# Admin backend deployment

The admin API is deployed as part of the existing `vowch-dev` SAM stack; it is not a separate service or environment.

Before deploying, assign the intended operations user to one Cognito group: `vowch-super-admin`, `vowch-trust-reviewer`, `vowch-ops-reviewer`, `vowch-finance-reviewer`, or `vowch-support-viewer`.

For post-deploy validation, set `COGNITO_ADMIN_TEST_TOKEN` as a GitHub environment secret. It must be a short-lived JWT for a user in `vowch-super-admin`. The deployment workflow then verifies the dashboard, member, gig, and payment APIs with that token.

Rotate the token after use. Do not use a member token, a production personal token, or a long-lived browser session token.
