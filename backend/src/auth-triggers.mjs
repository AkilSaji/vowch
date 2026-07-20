import { randomInt, createHash } from 'node:crypto';
import { sendEmail } from './email.mjs';

export const defineAuthChallenge = async (event) => {
  const sessions = event.request.session || [];
  if (sessions.length > 0 && sessions.at(-1).challengeName === 'CUSTOM_CHALLENGE' && sessions.at(-1).challengeResult === true) {
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  } else if (sessions.length >= 3) {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  } else {
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    event.response.challengeName = 'CUSTOM_CHALLENGE';
  }
  return event;
};

export const createAuthChallenge = async (event) => {
  if (event.request.challengeName === 'CUSTOM_CHALLENGE') {
    const code = String(randomInt(100000, 1000000));
    event.response.publicChallengeParameters = { delivery: 'email' };
    event.response.privateChallengeParameters = { answerHash: createHash('sha256').update(code).digest('hex') };
    event.response.challengeMetadata = 'VOWCH_EMAIL_OTP';
    await sendEmail({ to: event.request.userAttributes?.email, subject: 'Your Vowch sign-in code', text: `Your Vowch code is ${code}. It expires shortly.`, html: `<h2>Your Vowch sign-in code</h2><p style="font-size:32px;font-weight:700;letter-spacing:4px">${code}</p><p>Valid for 5 minutes. Do not share this code.</p>` });
  }
  return event;
};

export const verifyAuthChallenge = async (event) => {
  const expected = event.request.privateChallengeParameters?.answerHash;
  const supplied = event.request.challengeAnswer || '';
  event.response.answerCorrect = createHash('sha256').update(supplied).digest('hex') === expected;
  return event;
};
