import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getXRedirectUri } from '@/lib/utils/redirect-uri';

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

  console.log('[X OAuth] Token response:', JSON.stringify(data, null, 2));

  if (!response.ok) {
    return NextResponse.json({ error: data }, { status: response.status });
  }

  // Stocker le token dans un cookie (accessible côté serveur)
  const cookieStore = await cookies();
  const expiresIn = data.expires_in || 7200; // 2 heures par défaut
  
  cookieStore.set('x_access_token', data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: expiresIn,
    path: '/',
  });

  if (data.refresh_token) {
    cookieStore.set('x_refresh_token', data.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 an
      path: '/',
    });
  }

  console.log('[X OAuth] ✅ Tokens stored in cookies');

  return NextResponse.json({
    success: true,
    message: 'Tokens received and stored in cookies',
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  });
}

