import { authenticate } from '@google-cloud/local-auth';
import { resolve } from 'node:path';

const scopes = ['https://www.googleapis.com/auth/meetings.space.readonly'];
const keyfilePath = resolve(process.cwd(), 'credentials.json');

async function main() {
  console.log('Opening browser for Google Meet authorization...');
  const auth = await authenticate({
    scopes,
    keyfilePath,
  });

  const tokens = auth.credentials;
  console.log('\n============================================================');
  console.log('RENDER ENVIRONMENT VARIABLE:');
  if (tokens.refresh_token) {
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  } else {
    console.log('⚠️  No refresh token returned because you already granted access earlier.');
    console.log('To get a refresh token: revoke access at https://myaccount.google.com/permissions and re-run this script.');
  }
  console.log('============================================================\n');
}

main().catch(console.error);
