import nodemailer from 'nodemailer';

let transporter;

const config = () => ({ user: String(process.env.GMAIL_SMTP_USER || '').trim(), password: String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '') });

export const isEmailConfigured = () => {
  const { user, password } = config();
  return Boolean(user && password);
};

const mailer = () => {
  if (!isEmailConfigured()) throw new Error('GMAIL_SMTP_NOT_CONFIGURED');
  if (!transporter) {
    const { user, password } = config();
    transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass: password } });
  }
  return transporter;
};

export const sendEmail = async ({ to, subject, text, html }) => {
  const { user } = config();
  if (!to) throw new Error('EMAIL_RECIPIENT_REQUIRED');
  return mailer().sendMail({ from: `"Vowch" <${user}>`, to, subject, text, html: html || undefined });
};
