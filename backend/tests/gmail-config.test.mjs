import test from 'node:test';
import assert from 'node:assert/strict';
import { isEmailConfigured } from '../src/email.mjs';

test('Gmail SMTP requires both an account and app password', () => {
  const previousUser = process.env.GMAIL_SMTP_USER; const previousPassword = process.env.GMAIL_APP_PASSWORD;
  try {
    process.env.GMAIL_SMTP_USER = ''; process.env.GMAIL_APP_PASSWORD = ''; assert.equal(isEmailConfigured(), false);
    process.env.GMAIL_SMTP_USER = 'demo@example.com'; process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop'; assert.equal(isEmailConfigured(), true);
  } finally {
    if (previousUser === undefined) delete process.env.GMAIL_SMTP_USER; else process.env.GMAIL_SMTP_USER = previousUser;
    if (previousPassword === undefined) delete process.env.GMAIL_APP_PASSWORD; else process.env.GMAIL_APP_PASSWORD = previousPassword;
  }
});
