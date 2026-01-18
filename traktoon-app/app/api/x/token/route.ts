import { NextResponse } from 'next/server';

// OAuth 2.0 - Step 2: Exchange code for tokens

const CLIENT_ID = process.env.X_CLIENT_ID!;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET!;
const REDIRECT_URI = process.env.X_REDIRECT_URI || 'http://localhost:3000/api/x/callback';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';

export async function POST(request: Request) {
  const { code, codeVerifier } = await request.json();

  if (!code || !codeVerifier) {
    return NextResponse.json(
      { error: 'Missing code or codeVerifier' },
      { status: 400 }
    );
  }

  // Prepare the token request
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const params = new URLSearchParams();
  params.set('grant_type', 'authorization_code');
  params.set('code', code);
  params.set('redirect_uri', REDIRECT_URI);
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

  // SUCCESS! Save these tokens
  console.log('\n========================================');
  console.log('✅ TOKENS RECEIVED! Add to your .env:');
  console.log(`X_ACCESS_TOKEN=${data.access_token}`);
  console.log(`X_REFRESH_TOKEN=${data.refresh_token}`);
  console.log('========================================\n');

  return NextResponse.json({
    success: true,
    message: 'Tokens received! Add them to your .env file',
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  });
}

