import { setAccessToken } from './api';

const region = process.env.EXPO_PUBLIC_COGNITO_REGION || 'us-east-1';
const clientId = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID || '';
const endpoint = `https://cognito-idp.${region}.amazonaws.com/`;

async function cognito(target: string, body: Record<string, unknown>) {
  if (!clientId) throw new Error('Cognito is not configured.');
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}` }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({})) as { Session?: string; AuthenticationResult?: { AccessToken?: string }; message?: string; __type?: string };
  if (!response.ok) throw new Error(data.message || data.__type || 'Authentication request failed.');
  return data;
}

export const mobileAuth = {
  configured: Boolean(clientId),
  async ensureUser(email: string) {
    try {
      const password = `Vw!${Date.now().toString(36)}${Math.random().toString(36).slice(2)}9Z`;
      await cognito('SignUp', { ClientId: clientId, Username: email, Password: password, UserAttributes: [{ Name: 'email', Value: email }] });
    } catch (error) {
      if (!String(error).includes('UsernameExistsException')) throw error;
    }
  },
  async startOtp(email: string) { await this.ensureUser(email); return this.beginOtp(email); },
  async beginOtp(email: string) { const data = await cognito('InitiateAuth', { ClientId: clientId, AuthFlow: 'CUSTOM_AUTH', AuthParameters: { USERNAME: email } }); if (!data.Session) throw new Error('Unable to start email sign-in.'); return data.Session; },
  async answerOtp(email: string, session: string, code: string) { const data = await cognito('RespondToAuthChallenge', { ClientId: clientId, ChallengeName: 'CUSTOM_CHALLENGE', Session: session, ChallengeResponses: { USERNAME: email, ANSWER: code } }); if (!data.AuthenticationResult?.AccessToken) throw new Error('The code was not accepted.'); setAccessToken(data.AuthenticationResult.AccessToken); return data.AuthenticationResult.AccessToken; },
};
