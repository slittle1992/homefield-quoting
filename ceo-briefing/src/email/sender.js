const { google } = require('googleapis');
const config = require('../config');
const { createLogger } = require('../utils/logger');
const { withRetry } = require('../utils/retry');

const log = createLogger('gmail');

function createOAuth2Client() {
  const oauth2 = new google.auth.OAuth2(
    config.gmail.clientId,
    config.gmail.clientSecret,
    'https://developers.google.com/oauthplayground'
  );
  oauth2.setCredentials({ refresh_token: config.gmail.refreshToken });
  return oauth2;
}

function buildRawEmail({ to, subject, html }) {
  const boundary = 'boundary_' + Date.now();
  const lines = [
    `From: ${config.gmail.senderEmail}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html).toString('base64'),
    '',
    `--${boundary}--`,
  ];
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

async function sendEmail({ to, subject, html }) {
  if (!config.gmail.clientId || !config.gmail.refreshToken) {
    log.warn(`Gmail not configured — would send "${subject}" to ${to}`);
    return { skipped: true, reason: 'Gmail not configured' };
  }

  const actualTo = config.isTest ? config.recipients.ceo : to;
  const actualSubject = config.isTest ? `[TEST] ${subject}` : subject;

  log.info(`Sending email: "${actualSubject}" to ${actualTo}`);

  const auth = createOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth });
  const raw = buildRawEmail({ to: actualTo, subject: actualSubject, html });

  return withRetry(
    async () => {
      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });
      log.info(`Email sent successfully`, { messageId: res.data.id });
      return { sent: true, messageId: res.data.id };
    },
    { retries: 2, label: `send email to ${actualTo}` }
  );
}

module.exports = { sendEmail };
