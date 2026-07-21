# Vowch mobile

Expo + React Native mobile client for Vowch. It runs in a polished demo mode when `EXPO_PUBLIC_API_URL` is absent, then switches to the deployed AWS API when configured.

```powershell
cd apps/mobile
npm.cmd install
Copy-Item .env.example .env
npm.cmd run start
```

For a hackathon submission, use Expo Go for device testing and EAS Build for a signed Android/iOS artifact. Set `EXPO_PUBLIC_API_URL` to the API Gateway base URL and `EXPO_PUBLIC_DEMO_MODE=false` only after the AWS stack is deployed.
