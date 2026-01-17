import { NextResponse } from 'next/server';
import crypto from 'crypto';

// OAuth 2.0 with PKCE
// Step 1: Generate authorization URL

const CLIENT_ID = process.env.X_CLIENT_ID!;
const REDIRECT_URI = process.env.X_REDIRECT_URI || 'http://localhost:3000/api/x/callback';
const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];

// Generate PKCE code verifier and challenge
function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

export async function GET() {
  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString('hex');

  const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  // IMPORTANT: Save this code_verifier - you'll need it to exchange the code!
  console.log('\n========================================');
  console.log('🔐 CODE VERIFIER (save this!):');
  console.log(codeVerifier);
  console.log('========================================\n');

  return NextResponse.json({
    message: 'Open this URL in your browser to authorize:',
    authUrl: authUrl.toString(),
    codeVerifier: codeVerifier,
    instructions: [
      '1. Open the authUrl in your browser',
      '2. Authorize the app',
      '3. Copy the "code" from the URL bar (after ?code=...)',
      '4. Call POST /api/x/token with { code, codeVerifier }'
    ]
  });
}

