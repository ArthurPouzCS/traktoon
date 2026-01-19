import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildOAuth1Header } from '@/lib/x/oauth1';

const TWEET_ENDPOINT_V2 = 'https://api.twitter.com/2/tweets';
const MEDIA_UPLOAD_ENDPOINT = 'https://upload.twitter.com/1.1/media/upload.json';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const MAX_TWEET_LENGTH = 280;

// Fonction pour tronquer le texte si nécessaire
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

// Vérifier si un token est expiré
function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const expiryDate = new Date(expiresAt);
  const now = new Date();
  // Considérer comme expiré si la date d'expiration est passée ou dans les 5 prochaines minutes
  return expiryDate.getTime() <= now.getTime() + 5 * 60 * 1000;
}

// Récupérer un token OAuth2 valide depuis Supabase
async function getValidAccessToken(userId: string): Promise<string> {
  const { createServiceRoleClient } = await import('@/lib/supabase/server');
  const supabase = createServiceRoleClient();

  // Récupérer la connexion depuis Supabase
  const { data: connection, error: fetchError } = await supabase
    .from('social_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', 'twitter')
    .single();

  if (fetchError || !connection) {
    throw new Error('No Twitter connection found. Please connect your X account first.');
  }

  // Vérifier si le token est expiré
  if (isTokenExpired(connection.expires_at)) {
    if (!connection.refresh_token) {
      throw new Error('Token expired and no refresh token available. Please reconnect your X account.');
    }

    // Rafraîchir le token avec OAuth 2.0
    const CLIENT_ID = process.env.X_CLIENT_ID!;
    const CLIENT_SECRET = process.env.X_CLIENT_SECRET!;
    
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const params = new URLSearchParams();
    params.set('refresh_token', connection.refresh_token);
    params.set('grant_type', 'refresh_token');

    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(`Failed to refresh token: ${JSON.stringify(errorData)}`);
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const expiresIn = tokenData.expires_in || 7200; // 2 heures par défaut
    const expiresAt = new Date(Date.now() + (expiresIn - 300) * 1000); // Soustraire 5 min pour marge

    // Mettre à jour dans Supabase
    const { error: updateError } = await supabase
      .from('social_connections')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || connection.refresh_token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'twitter');

    if (updateError) {
      throw new Error(`Failed to update token: ${updateError.message}`);
    }

    return tokenData.access_token;
  }

    return connection.access_token;
}

interface OAuth1Tokens {
  accessToken: string;
  accessTokenSecret: string;
}

// Récupérer les tokens OAuth1 (pour upload média, etc.)
async function getOAuth1Tokens(userId: string): Promise<OAuth1Tokens> {
  const { createServiceRoleClient } = await import('@/lib/supabase/server');
  const supabase = createServiceRoleClient();

  const { data: connection, error } = await supabase
    .from('social_connections')
    .select('oauth1_access_token, oauth1_access_token_secret')
    .eq('user_id', userId)
    .eq('provider', 'twitter')
    .single();

  if (error || !connection) {
    throw new Error(
      "No Twitter OAuth1 connection found. Please complete the X OAuth1 connection to enable image uploads.",
    );
  }

  if (!connection.oauth1_access_token || !connection.oauth1_access_token_secret) {
    throw new Error(
      "Twitter OAuth1 tokens are missing. Please reconnect your X account with OAuth1 to enable image uploads.",
    );
  }

  return {
    accessToken: connection.oauth1_access_token,
    accessTokenSecret: connection.oauth1_access_token_secret,
  };
}

interface TweetResult {
  success: boolean;
  data: unknown;
  tweetId: string | null;
  status: number;
}

async function postTweetWithOAuth2(
  userId: string,
  text: string,
  mediaId?: string,
): Promise<TweetResult> {
  const accessToken = await getValidAccessToken(userId);

  const tweetBody: { text: string; media?: { media_ids: string[] } } = {
    text,
  };

  if (mediaId) {
    tweetBody.media = {
      media_ids: [mediaId],
    };
  }

  console.log('[X API] Posting tweet with OAuth 2.0 Bearer token...');
  console.log('[X API] Tweet text:', text);
  console.log('[X API] Has media:', !!mediaId);

  const response = await fetch(TWEET_ENDPOINT_V2, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tweetBody),
  });

  const data = (await response.json()) as unknown;

  console.log('[X API] OAuth2 Status:', response.status);
  console.log('[X API] OAuth2 Response:', JSON.stringify(data, null, 2));

  const tweetId = (data as { data?: { id?: string } }).data?.id ?? null;

  return {
    success: response.ok,
    data,
    tweetId,
    status: response.status,
  };
}

async function postTweetWithOAuth1(
  userId: string,
  text: string,
  mediaId?: string,
): Promise<TweetResult> {
  const oauth1Tokens = await getOAuth1Tokens(userId);

  const consumerKey = process.env.X_OAUTH1_CONSUMER_KEY;
  const consumerSecret = process.env.X_OAUTH1_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error("X_OAUTH1_CONSUMER_KEY or X_OAUTH1_CONSUMER_SECRET is not configured");
  }

  // Pour l'API v2 avec OAuth 1.0a, on utilise un body JSON
  // Le body JSON n'est PAS inclus dans la signature OAuth 1.0a
  const tweetBody: { text: string; media?: { media_ids: string[] } } = {
    text,
  };

  if (mediaId) {
    tweetBody.media = {
      media_ids: [mediaId],
    };
  }

  // Signature OAuth 1.0a sans body (car body JSON)
  const { authorizationHeader } = buildOAuth1Header(
    {
      consumerKey,
      consumerSecret,
      token: oauth1Tokens.accessToken,
      tokenSecret: oauth1Tokens.accessTokenSecret,
    },
    {
      method: "POST",
      url: TWEET_ENDPOINT_V2,
      // Pas de bodyParams car body JSON
    },
  );

  console.log('[X API] Posting tweet with OAuth 1.0a (user context) via API v2...');
  console.log('[X API] Tweet text:', text);
  console.log('[X API] Has media:', !!mediaId);

  const response = await fetch(TWEET_ENDPOINT_V2, {
    method: "POST",
    headers: {
      Authorization: authorizationHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tweetBody),
  });

  const data = (await response.json()) as unknown;

  console.log('[X API] OAuth1 Status:', response.status);
  console.log('[X API] OAuth1 Response:', JSON.stringify(data, null, 2));

  // L'API v2 retourne { data: { id: string } }
  const tweetId = (data as { data?: { id?: string } }).data?.id ?? null;

  return {
    success: response.ok,
    data,
    tweetId,
    status: response.status,
  };
}

export interface XPostMetrics {
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  engagement_rate: number;
}

// Fonction helper pour vérifier si le token est valide
async function verifyTokenValidity(accessToken: string, useOAuth1: boolean = false): Promise<boolean> {
  try {
    if (useOAuth1) {
      // Pour OAuth 1.0a, on ne peut pas facilement tester sans les tokens
      // On retourne true par défaut et on laisse l'appel réel échouer si nécessaire
      return true;
    }
    // Tester le token en récupérant les infos de l'utilisateur
    const response = await fetch("https://api.twitter.com/2/users/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getXPostMetrics(
  userId: string,
  tweetId: string,
): Promise<XPostMetrics> {
  // Essayer d'abord avec OAuth 2.0, puis fallback sur OAuth 1.0a
  let response: Response;
  let useOAuth1 = false;
  
  try {
    // Essayer OAuth 2.0 d'abord
    const accessToken = await getValidAccessToken(userId);
    const url = `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`;
    
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    
    // Si 401 avec OAuth 2.0, essayer OAuth 1.0a
    if (response.status === 401) {
      console.log('[X API] OAuth 2.0 failed with 401, trying OAuth 1.0a...');
      useOAuth1 = true;
      throw new Error('OAuth 2.0 failed, trying OAuth 1.0a');
    }
  } catch (error) {
    // Si OAuth 2.0 échoue ou n'est pas disponible, utiliser OAuth 1.0a
    if (!(error instanceof Error && error.message.includes('OAuth 1.0a'))) {
      // Si c'est une autre erreur (pas de token OAuth 2.0), essayer OAuth 1.0a
      useOAuth1 = true;
    }
    
    if (useOAuth1) {
      const oauth1Tokens = await getOAuth1Tokens(userId);
      const consumerKey = process.env.X_OAUTH1_CONSUMER_KEY;
      const consumerSecret = process.env.X_OAUTH1_CONSUMER_SECRET;
      
      if (!consumerKey || !consumerSecret) {
        throw new Error("X_OAUTH1_CONSUMER_KEY or X_OAUTH1_CONSUMER_SECRET is not configured");
      }
      
      const url = `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`;
      const urlObj = new URL(url);
      const queryParams: Record<string, string> = {};
      urlObj.searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });
      
      const { authorizationHeader } = buildOAuth1Header(
        {
          consumerKey,
          consumerSecret,
          token: oauth1Tokens.accessToken,
          tokenSecret: oauth1Tokens.accessTokenSecret,
        },
        {
          method: "GET",
          url: urlObj.origin + urlObj.pathname,
          queryParams,
        },
      );
      
      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: authorizationHeader,
          "Content-Type": "application/json",
        },
      });
    } else {
      throw error;
    }
  }

  if (!response.ok) {
    const errorData = await response.json() as {
      title?: string;
      detail?: string;
      type?: string;
      status?: number;
      errors?: Array<{ message?: string; code?: number }>;
    };
    
    // Analyser l'erreur pour déterminer si c'est un post supprimé ou un problème d'authentification
    const errorMessage = errorData.detail || errorData.title || JSON.stringify(errorData);
    const errorCode = response.status;
    
    // Si c'est une 404, le post n'existe plus
    if (errorCode === 404) {
      throw new Error(`Post not found: ${errorCode} ${errorMessage}`);
    }
    
    // Si c'est une 401, vérifier si le token est valide
    // Si le token est valide et qu'on obtient 401 pour un post spécifique, 
    // c'est probablement que le post n'existe plus ou n'est pas accessible
    if (errorCode === 401) {
      // Vérifier si le message indique que le post n'existe pas
      const lowerMessage = errorMessage.toLowerCase();
      if (
        lowerMessage.includes("not found") ||
        lowerMessage.includes("does not exist") ||
        lowerMessage.includes("could not be found")
      ) {
        // C'est probablement un post supprimé, traiter comme 404
        throw new Error(`Post not found: 404 ${errorMessage}`);
      }
      
      // Si on utilise OAuth 1.0a, on ne peut pas facilement vérifier la validité du token
      // mais si on obtient 401 avec OAuth 1.0a, c'est probablement que le post n'existe plus
      if (useOAuth1) {
        // Avec OAuth 1.0a, une 401 peut signifier que le post n'existe plus
        // On considère que c'est un post supprimé
        throw new Error(`Post not found: 404 ${errorMessage}`);
      }
      
      // Pour OAuth 2.0, vérifier si le token est valide
      // Si le token est valide, alors la 401 pour ce post signifie probablement
      // que le post n'existe plus ou n'est pas accessible
      try {
        const accessToken = await getValidAccessToken(userId);
        const isTokenValid = await verifyTokenValidity(accessToken, false);
        if (isTokenValid) {
          // Le token est valide, donc la 401 pour ce post signifie qu'il n'existe plus
          throw new Error(`Post not found: 404 Token valid but post not accessible`);
        }
      } catch (tokenError) {
        // Si on ne peut pas récupérer le token, on considère que c'est un problème d'auth
      }
      
      // Le token n'est pas valide, c'est vraiment une erreur d'authentification
      throw new Error(`Failed to get tweet metrics: ${errorCode} ${JSON.stringify(errorData)}`);
    }
    
    // Pour les autres erreurs
    throw new Error(`Failed to get tweet metrics: ${errorCode} ${JSON.stringify(errorData)}`);
  }

  const data = (await response.json()) as {
    data?: {
      public_metrics?: {
        impression_count?: number;
        like_count?: number;
        retweet_count?: number;
        reply_count?: number;
      };
    };
    errors?: Array<{ message?: string; code?: number }>;
  };

  // Si pas de data mais des erreurs, le post n'existe probablement plus
  if (!data.data && data.errors && data.errors.length > 0) {
    const errorMessages = data.errors.map(e => e.message || "").join(", ");
    const errorCodes = data.errors.map(e => e.code || 0);
    
    // Si l'erreur indique que le tweet n'existe pas
    if (errorMessages.toLowerCase().includes("not found") || 
        errorMessages.toLowerCase().includes("does not exist") ||
        errorCodes.includes(144) || // Code d'erreur Twitter pour "No status found with that ID"
        errorCodes.includes(34)) {  // Code d'erreur Twitter pour "Sorry, that page does not exist"
      throw new Error(`Post not found: 404 ${errorMessages}`);
    }
  }

  // Si pas de data du tout, le post n'existe probablement plus
  if (!data.data) {
    throw new Error(`Post not found: 404 No data returned from API`);
  }

  const metrics = data.data.public_metrics || {};
  const impressions = metrics.impression_count || 0;
  const likes = metrics.like_count || 0;
  const retweets = metrics.retweet_count || 0;
  const replies = metrics.reply_count || 0;

  // Calculer le taux d'engagement
  const totalEngagement = likes + retweets + replies;
  const engagement_rate = impressions > 0 ? (totalEngagement / impressions) * 100 : 0;

  return {
    impressions,
    likes,
    retweets,
    replies,
    engagement_rate,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { text, imageBase64, planId } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Missing text field' }, { status: 400 });
    }

    // Vérifier que l'utilisateur est authentifié
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Tronquer le texte si nécessaire
    const truncatedText = truncateText(text, MAX_TWEET_LENGTH);

    let mediaId: string | undefined;

    // Upload de l'image si fournie (via OAuth1)
    if (imageBase64) {
      try {
        // Convertir base64 en data pur (enlever le préfixe data:image/...;base64, si présent)
        const base64Data = imageBase64.includes(',')
          ? imageBase64.split(',')[1]
          : imageBase64;

        // Récupérer les tokens OAuth1
        const oauth1Tokens = await getOAuth1Tokens(user.id);

        const bodyParams: Record<string, string> = {
          media_data: base64Data,
        };

        const consumerKey = process.env.X_OAUTH1_CONSUMER_KEY;
        const consumerSecret = process.env.X_OAUTH1_CONSUMER_SECRET;

        if (!consumerKey || !consumerSecret) {
          throw new Error("X_OAUTH1_CONSUMER_KEY or X_OAUTH1_CONSUMER_SECRET is not configured");
        }

        const { authorizationHeader } = buildOAuth1Header(
          {
            consumerKey,
            consumerSecret,
            token: oauth1Tokens.accessToken,
            tokenSecret: oauth1Tokens.accessTokenSecret,
          },
          {
            method: "POST",
            url: MEDIA_UPLOAD_ENDPOINT,
            bodyParams,
          },
        );

        const mediaResponse = await fetch(MEDIA_UPLOAD_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: authorizationHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(bodyParams).toString(),
        });

        if (!mediaResponse.ok) {
          const mediaError = await mediaResponse.json();
          console.error("[X API] Media upload failed:", mediaError);
          // Continuer sans image plutôt que d'échouer complètement
        } else {
          const mediaData = (await mediaResponse.json()) as { media_id_string: string };
          mediaId = mediaData.media_id_string;
          console.log("[X API] Media uploaded successfully, media_id:", mediaId);
        }
      } catch (error) {
        console.error("[X API] Error uploading media via OAuth1:", error);
        // Continuer sans image plutôt que d'échouer complètement
      }
    }

    // Envoyer le tweet :
    // - Si pas d'image, on essaie d'abord OAuth2 (v2 /tweets), puis fallback OAuth1 si échec
    // - Si image, on passe directement par OAuth1 (v2 /tweets avec OAuth 1.0a) car l'upload média nécessite OAuth1
    let tweetResult: TweetResult | null = null;

    if (!imageBase64) {
      try {
        tweetResult = await postTweetWithOAuth2(user.id, truncatedText, mediaId);
      } catch (error) {
        console.warn("[X API] OAuth2 tweet failed, will try OAuth1 if available:", error);
      }
    }

    // Si pas de résultat ou échec, utiliser OAuth1 (nécessaire pour les images, fallback sinon)
    if (!tweetResult || !tweetResult.success) {
      tweetResult = await postTweetWithOAuth1(user.id, truncatedText, mediaId);
    }

    const { success, data, tweetId, status } = tweetResult;

    if (!success) {
      return NextResponse.json({ error: data }, { status });
    }

    // Sauvegarder le post en base de données
    if (tweetId) {
      try {
        const { error: insertError } = await supabase
          .from('posts')
          .insert({
            user_id: user.id,
            provider: 'twitter',
            provider_post_id: tweetId,
            content: truncatedText,
            plan_id: planId || null,
          });

        if (insertError) {
          console.error('[X API] Error saving post to database:', insertError);
          // Ne pas faire échouer la requête si la sauvegarde échoue
        }
      } catch (dbError) {
        console.error('[X API] Error saving post to database:', dbError);
        // Ne pas faire échouer la requête si la sauvegarde échoue
      }
    }

    return NextResponse.json({ success: true, data, postId: tweetId });
  } catch (error) {
    console.error('[X API] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create tweet',
      },
      { status: 500 }
    );
  }
}
