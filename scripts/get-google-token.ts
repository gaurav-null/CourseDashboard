import fs from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authenticate } from '@google-cloud/local-auth';

const scopes = ['https://www.googleapis.com/auth/meetings.space.readonly'];

function findCredentialsFile(): string {
  const candidates = [
    resolve(dirname(fileURLToPath(import.meta.url)), '../credentials.json'),
    resolve(process.cwd(), 'credentials.json'),
    resolve(process.cwd(), '../credentials.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const keyfilePath = findCredentialsFile();

async function main() {
  console.log(`Using credentials file: ${keyfilePath}`);
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

