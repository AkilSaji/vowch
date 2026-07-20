# Vowch admin portal

This is a static React portal for Vowch operations. It sends the administrator's
short-lived Cognito **access token** directly to the Vowch API; the token is kept
only in the current browser tab and is never added to Netlify environment variables.

## Local run

```powershell
cd apps/admin-portal
Copy-Item .env.example .env
npm install
npm run dev
```

Set `VITE_API_URL` to the `ApiUrl` CloudFormation output. If the output ends in a
stage such as `/Prod`, keep that stage in the value.

## Netlify deployment

1. Push this repository to GitHub.
2. In Netlify, select **Add new site** > **Import an existing project**.
3. Pick the repository. Netlify reads the repository-root `netlify.toml`; do not
   override its base, build command, or publish directory.
4. Add environment variable `VITE_API_URL` with the deployed API Gateway URL.
5. Deploy, then copy the resulting `https://...netlify.app` address.
6. Set the backend `PUBLIC_APP_ORIGIN` value to that exact Netlify URL and redeploy
   the SAM stack. This permits the browser to call the API through CORS.

To use the portal, sign in through the Vowch Cognito flow as an account in an
admin group, obtain its **access token**, and paste it into the portal. Do not use
an ID token or store a token in Netlify/GitHub.
