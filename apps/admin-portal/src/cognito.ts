const region = import.meta.env.VITE_COGNITO_REGION || 'us-east-1';
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || '';
const endpoint = `https://cognito-idp.${region}.amazonaws.com/`;
type ResponseBody = { ChallengeName?: string; Session?: string; AuthenticationResult?: { AccessToken?: string }; __type?: string; message?: string };

async function request(target: string, body: Record<string, unknown>): Promise<ResponseBody> {
  if (!clientId) throw new Error('Cognito is not configured. Add VITE_COGNITO_CLIENT_ID in Vercel.');
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}` }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({})) as ResponseBody;
  if (!response.ok) throw new Error(data.message || data.__type?.replace(/^.*#/, '') || 'Authentication request failed.');
  return data;
}

export const adminAuth = {
  configured: Boolean(clientId),
  async ensureUser(email: string) {
    try {
      const password = `Vw!${Array.from(crypto.getRandomValues(new Uint32Array(4))).join('')}a9Z`;
      await request('SignUp', { ClientId: clientId, Username: email, Password: password, UserAttributes: [{ Name: 'email', Value: email }] });
    } catch (error) {
      if (!/UsernameExistsException|User already exists/i.test(String(error))) throw error;
    }
  },
  async startOtp(email: string) { await this.ensureUser(email); return this.beginOtp(email); },
  async beginOtp(email: string) { const data = await request('InitiateAuth', { ClientId: clientId, AuthFlow: 'CUSTOM_AUTH', AuthParameters: { USERNAME: email } }); if (!data.Session) throw new Error('Unable to start email sign-in.'); return data.Session; },
  async verifyOtp(email: string, session: string, code: string) { const data = await request('RespondToAuthChallenge', { ClientId: clientId, ChallengeName: 'CUSTOM_CHALLENGE', Session: session, ChallengeResponses: { USERNAME: email, ANSWER: code } }); const token = data.AuthenticationResult?.AccessToken; if (!token) throw new Error('The code was not accepted.'); return token; },
};
