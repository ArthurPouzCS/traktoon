import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getXRedirectUri, getRedirectUri } from '@/lib/utils/redirect-uri';
import { createServiceRoleClient } from '@/lib/supabase/server';

// OAuth 2.0 Callback Handler
// Receives the authorization code from X and exchanges it for tokens

const CLIENT_ID = process.env.X_CLIENT_ID!;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET!;
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  console.log('[X Callback] Received:', { code: code?.substring(0, 20) + '...', state, error });

  // Fonction helper pour construire l'URL de redirection avec la base URL dynamique
  const getRedirectUrl = (path: string, params?: Record<string, string>): string => {
    const baseUrl = getRedirectUri(path);
    const url = new URL(baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    return url.toString();
  };

  // Vérifier s'il y a une erreur de X
  if (error) {
    const errorUrl = getRedirectUrl('/connections', { error });
    return NextResponse.redirect(errorUrl);
  }

  if (!code || !state) {
    const errorUrl = getRedirectUrl('/connections', { error: 'missing_code_or_state' });
    return NextResponse.redirect(errorUrl);
  }

  try {
    const cookieStore = await cookies();
    const storedState = cookieStore.get('x_oauth_state')?.value;
    const codeVerifier = cookieStore.get('x_code_verifier')?.value;
    const userId = cookieStore.get('x_oauth_user_id')?.value;

    // Vérifier le state (protection CSRF)
    if (!storedState || storedState !== state) {
      const errorUrl = getRedirectUrl('/connections', { error: 'invalid_state' });
      return NextResponse.redirect(errorUrl);
    }

    if (!codeVerifier) {
      const errorUrl = getRedirectUrl('/connections', { error: 'missing_code_verifier' });
      return NextResponse.redirect(errorUrl);
    }

    if (!userId) {
      const errorUrl = getRedirectUrl('/connections', { error: 'user_not_found' });
      return NextResponse.redirect(errorUrl);
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
      const errorUrl = getRedirectUrl('/connections', { error: 'token_exchange_failed' });
      return NextResponse.redirect(errorUrl);
    }

    // Récupérer les informations utilisateur Twitter
    const userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=username', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    let twitterUsername: string | null = null;
    let twitterUserId: string | null = null;

    if (userResponse.ok) {
      const userData = await userResponse.json() as { data?: { id: string; username: string } };
      if (userData.data) {
        twitterUserId = userData.data.id;
        twitterUsername = userData.data.username;
      }
    } else {
      console.warn('[X Callback] Failed to fetch Twitter user info:', await userResponse.text());
    }

    // Calculer la date d'expiration
    const expiresIn = tokenData.expires_in || 7200; // 2 heures par défaut
    const expiresAt = new Date(Date.now() + (expiresIn - 300) * 1000); // Soustraire 5 min pour marge

    // Stocker dans Supabase
    const supabase = createServiceRoleClient();
    const { error: upsertError } = await supabase.from('social_connections').upsert(
      {
        user_id: userId,
        provider: 'twitter',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        expires_at: expiresAt.toISOString(),
        scope: SCOPES.join(' '),
        provider_user_id: twitterUserId,
        provider_username: twitterUsername,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,provider',
      },
    );

    if (upsertError) {
      console.error('[X Callback] Error storing connection in Supabase:', upsertError);
      const errorUrl = getRedirectUrl('/connections', { error: 'storage_error' });
      return NextResponse.redirect(errorUrl);
    }

    // Stocker les tokens dans les cookies aussi (pour l'API)

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
    cookieStore.delete('x_oauth_user_id');

    console.log('[X Callback] ✅ Tokens stored in cookies and Supabase');

    // Rediriger vers /connections avec un message de succès
    const successUrl = getRedirectUrl('/connections', { success: 'x_connected' });
    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error('[X Callback] Error:', error);
    const errorUrl = getRedirectUrl('/connections', { 
      error: error instanceof Error ? error.message : 'internal_error' 
    });
    return NextResponse.redirect(errorUrl);
  }
}
