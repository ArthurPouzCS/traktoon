import { NextResponse } from 'next/server';
import { storeTokens } from '@/lib/x/token-manager';

// OAuth 2.0 - Step 2: Exchange code for tokens

const CLIENT_ID = process.env.X_CLIENT_ID!;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET!;
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';

export async function POST(request: Request) {
  const { code, codeVerifier } = await request.json();

  if (!code || !codeVerifier) {
    return NextResponse.json(
      { error: 'Missing code or codeVerifier' },
      { status: 400 }
    );
  }

  // Générer l'URL de redirection dynamiquement
  const redirectUri = process.env.X_REDIRECT_URI || getXRedirectUri();

  // Prepare the token request
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const params = new URLSearchParams();
  params.set('grant_type', 'authorization_code');
  params.set('code', code);
  params.set('redirect_uri', redirectUri);
  params.set('code_verifier', codeVerifier);

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: params.toString(),
  });

  const data = await response.json();

  console.log('[X OAuth] Token response status:', response.status);

  if (!response.ok) {
    console.error('[X OAuth] Token error:', data);
    return NextResponse.json({ error: data }, { status: response.status });
  }

  // Store tokens in memory for auto-refresh
  storeTokens(data.access_token, data.refresh_token, data.expires_in);

  console.log('[X OAuth] Tokens stored successfully!');
  console.log('[X OAuth] Access token:', data.access_token.substring(0, 20) + '...');

  return NextResponse.json({
    success: true,
    message: 'Tokens received and stored! You can now post tweets.',
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  });
}
