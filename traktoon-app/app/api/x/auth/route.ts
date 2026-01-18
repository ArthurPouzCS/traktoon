import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getXRedirectUri } from '@/lib/utils/redirect-uri';

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

export async function GET(request: NextRequest) {
  try {
    if (!CLIENT_ID) {
      return NextResponse.json(
        { error: 'X_CLIENT_ID is not configured' },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();

    // Générer l'URL de redirection dynamiquement à partir de la base URL
    const redirectUri = process.env.X_REDIRECT_URI || getXRedirectUri();

    const { codeVerifier, codeChallenge } = generatePKCE();
    const state = crypto.randomBytes(16).toString('hex');

    // Stocker le code_verifier dans un cookie httpOnly
    cookieStore.set('x_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // Stocker le state dans un cookie pour vérification au callback
    cookieStore.set('x_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', SCOPES.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    // Rediriger vers X pour l'autorisation
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error initiating X OAuth:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

