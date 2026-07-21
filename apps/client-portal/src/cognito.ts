const region = import.meta.env.VITE_COGNITO_REGION || 'us-east-1';
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || '';
const endpoint = `https://cognito-idp.${region}.amazonaws.com/`;

type CognitoResponse = { ChallengeName?: string; Session?: string; AuthenticationResult?: { AccessToken?: string; IdToken?: string; RefreshToken?: string }; __type?: string; message?: string };

async function cognito(target: string, body: Record<string, unknown>): Promise<CognitoResponse> {
  if (!clientId) throw new Error('Cognito is not configured. Add VITE_COGNITO_CLIENT_ID in Vercel.');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as CognitoResponse;
  if (!response.ok) throw new Error(data.message || data.__type?.replace(/^.*#/, '') || 'Authentication request failed.');
  return data;
}

const demoPassword = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return `Vw!${Array.from(bytes, (item) => item.toString(36)).join('')}9Z`;
};

export const cognitoAuth = {
  configured: Boolean(clientId),
  async register(email: string) {
    try {
      await cognito('SignUp', { ClientId: clientId, Username: email, Password: demoPassword(), UserAttributes: [{ Name: 'email', Value: email }] });
      return { existing: false };
    } catch (error) {
      if (/UsernameExistsException|User already exists/i.test(String(error))) return { existing: true };
      throw error;
    }
  },
  async startOtp(email: string) { await this.register(email); return this.beginOtp(email); },
  async beginOtp(email: string) {
    const response = await cognito('InitiateAuth', { ClientId: clientId, AuthFlow: 'CUSTOM_AUTH', AuthParameters: { USERNAME: email } });
    if (response.ChallengeName !== 'CUSTOM_CHALLENGE' || !response.Session) throw new Error('Unable to start the Vowch email code challenge.');
    return response.Session;
  },
  async answerOtp(email: string, session: string, code: string) {
    const response = await cognito('RespondToAuthChallenge', { ClientId: clientId, ChallengeName: 'CUSTOM_CHALLENGE', Session: session, ChallengeResponses: { USERNAME: email, ANSWER: code } });
    const token = response.AuthenticationResult?.AccessToken;
    if (!token) throw new Error('That code was not accepted. Request a new code and try again.');
    return { accessToken: token, idToken: response.AuthenticationResult?.IdToken || '' };
  },
};
