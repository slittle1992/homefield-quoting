// Gmail OAuth2 Setup Helper
// Run: node setup-gmail.js <CLIENT_ID> <CLIENT_SECRET>
//
// This will open a URL — paste it in your browser, authorize, then paste the code back here.

const { google } = require('googleapis');
const readline = require('readline');

const clientId = process.argv[2];
const clientSecret = process.argv[3];

if (!clientId || !clientSecret) {
  console.log('\nUsage: node setup-gmail.js <CLIENT_ID> <CLIENT_SECRET>\n');
  console.log('Get these from Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID\n');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(
  clientId,
  clientSecret,
  'urn:ietf:wg:oauth:2.0:oob'
);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://mail.google.com/'],
  prompt: 'consent',
});

console.log('\n=== Gmail OAuth2 Setup ===\n');
console.log('1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Sign in with your Google Workspace / Gmail account');
console.log('3. Click "Allow"');
console.log('4. Copy the authorization code and paste it below\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Paste authorization code here: ', async (code) => {
  try {
    const { tokens } = await oauth2.getToken(code.trim());

    console.log('\n=== SUCCESS! ===\n');
    console.log('Add these to your .env file:\n');
    console.log(`GMAIL_CLIENT_ID=${clientId}`);
    console.log(`GMAIL_CLIENT_SECRET=${clientSecret}`);
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log(`GMAIL_SENDER_EMAIL=<your-email@domain.com>`);
    console.log('\nDon\'t forget to also set CEO_EMAIL, TREVOR_EMAIL, and STEVEN_EMAIL!\n');
  } catch (err) {
    console.error('\nError getting token:', err.message);
    console.log('\nMake sure you copied the full authorization code correctly.');
    console.log('If "redirect_uri_mismatch" — try the OAuth Playground method instead:');
    console.log('https://developers.google.com/oauthplayground\n');
  }
  rl.close();
});
