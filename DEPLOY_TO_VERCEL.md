# Vowch hackathon deployment

Use Vercel for three independently hosted sites from this one repository. A paid
domain is not needed: each receives a public `*.vercel.app` address.

## 1. Marketing website

- Create project: `vowch-marketing`
- Root Directory: `Vowch website`
- Framework Preset: `Other`
- Build Command: leave blank
- Output Directory: leave blank

The folder is already a static website and Vercel will serve its `index.html`.

## 2. Client portal

- Create project: `vowch-client`
- Root Directory: `apps/client-portal`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

## 3. Admin portal

- Create project: `vowch-admin`
- Root Directory: `apps/admin-portal`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variable: `VITE_API_URL` = the API Gateway `ApiUrl` output from the
  deployed Vowch AWS SAM stack.

After Vercel deploys the admin portal, set the backend `PUBLIC_APP_ORIGIN` value to
the exact admin Vercel URL and redeploy the backend. This enables browser CORS
requests. The client portal currently runs its supplied hackathon demo data, so it
does not need an API environment variable to be judged.

## Submission links

Submit the three Vercel URLs, the Expo Go mobile QR/APK, the GitHub repository URL,
and a short demo video. Label demo data clearly where it is used.
