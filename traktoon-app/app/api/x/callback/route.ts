import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getXRedirectUri } from '@/lib/utils/redirect-uri';

// OAuth 2.0 Callback Handler
// Receives the authorization code from X and exchanges it for tokens

const CLIENT_ID = process.env.X_CLIENT_ID!;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET!;
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  console.log('[X Callback] Received:', { code: code?.substring(0, 20) + '...', state, error });

  // Vérifier s'il y a une erreur de X
  if (error) {
    const errorUrl = new URL(request.nextUrl.origin);
    errorUrl.pathname = '/connections';
    errorUrl.searchParams.set('error', error);
    return NextResponse.redirect(errorUrl.toString());
  }

  if (!code || !state) {
    const errorUrl = new URL(request.nextUrl.origin);
    errorUrl.pathname = '/connections';
    errorUrl.searchParams.set('error', 'missing_code_or_state');
    return NextResponse.redirect(errorUrl.toString());
  }

  try {
    const cookieStore = await cookies();
    const storedState = cookieStore.get('x_oauth_state')?.value;
    const codeVerifier = cookieStore.get('x_code_verifier')?.value;

    // Vérifier le state (protection CSRF)
    if (!storedState || storedState !== state) {
      const errorUrl = new URL(request.nextUrl.origin);
      errorUrl.pathname = '/connections';
      errorUrl.searchParams.set('error', 'invalid_state');
      return NextResponse.redirect(errorUrl.toString());
    }

    if (!codeVerifier) {
      const errorUrl = new URL(request.nextUrl.origin);
      errorUrl.pathname = '/connections';
      errorUrl.searchParams.set('error', 'missing_code_verifier');
      return NextResponse.redirect(errorUrl.toString());
    }

    // Générer l'URL de redirection dynamiquement
    const redirectUri = process.env.X_REDIRECT_URI || getXRedirectUri();

    // Préparer la requête de token
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('code', code);
    params.set('redirect_uri', redirectUri);
    params.set('code_verifier', codeVerifier);

    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: params.toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('[X Callback] Token exchange failed:', tokenData);
      const errorUrl = new URL(request.nextUrl.origin);
      errorUrl.pathname = '/connections';
      errorUrl.searchParams.set('error', 'token_exchange_failed');
      return NextResponse.redirect(errorUrl.toString());
    }

    // Stocker les tokens dans les cookies
    const expiresIn = tokenData.expires_in || 7200; // 2 heures par défaut

    cookieStore.set('x_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn,
      path: '/',
    });

    if (tokenData.refresh_token) {
      cookieStore.set('x_refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 an
        path: '/',
      });
    }

    // Nettoyer les cookies temporaires
    cookieStore.delete('x_code_verifier');
    cookieStore.delete('x_oauth_state');

    console.log('[X Callback] ✅ Tokens stored in cookies');

    // Rediriger vers /connections avec un message de succès
    const successUrl = new URL(request.nextUrl.origin);
    successUrl.pathname = '/connections';
    successUrl.searchParams.set('success', 'x_connected');
    return NextResponse.redirect(successUrl.toString());
  } catch (error) {
    console.error('[X Callback] Error:', error);
    const errorUrl = new URL(request.nextUrl.origin);
    errorUrl.pathname = '/connections';
    errorUrl.searchParams.set('error', error instanceof Error ? error.message : 'internal_error');
    return NextResponse.redirect(errorUrl.toString());
  }
}
