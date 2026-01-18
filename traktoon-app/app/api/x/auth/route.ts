import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { storeCodeVerifier } from '@/lib/x/pkce-store';

// OAuth 2.0 with PKCE
// Step 1: Generate authorization URL

const CLIENT_ID = process.env.X_CLIENT_ID!;
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

  // Store code_verifier for later retrieval in callback
  storeCodeVerifier(state, codeVerifier);

  const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  console.log('[Auth] Generated auth URL with state:', state.substring(0, 8) + '...');

  return NextResponse.json({
    message: 'Open this URL in your browser to authorize:',
    authUrl: authUrl.toString(),
    codeVerifier: codeVerifier, // Still return for debugging/manual use
    state: state,
  });
}
