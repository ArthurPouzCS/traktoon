import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const TWEET_ENDPOINT = 'https://api.twitter.com/2/tweets';
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

// Récupérer un token valide depuis Supabase
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

export interface XPostMetrics {
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  engagement_rate: number;
}

export async function getXPostMetrics(
  userId: string,
  tweetId: string,
): Promise<XPostMetrics> {
  const accessToken = await getValidAccessToken(userId);

  // Récupérer les métriques du tweet via l'API v2
  // Note: L'API v2 nécessite des permissions spéciales pour les métriques publiques
  // Pour les métriques détaillées, il faut utiliser l'API Enterprise ou Analytics API
  const response = await fetch(
    `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to get tweet metrics: ${response.status} ${JSON.stringify(errorData)}`);
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
  };

  const metrics = data.data?.public_metrics || {};
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

    // Récupérer le token depuis Supabase
    const accessToken = await getValidAccessToken(user.id);

    // Tronquer le texte si nécessaire
    const truncatedText = truncateText(text, MAX_TWEET_LENGTH);

    let mediaId: string | undefined;

    // Upload de l'image si fournie
    if (imageBase64) {
      try {
        // Convertir base64 en data pur (enlever le préfixe data:image/...;base64, si présent)
        const base64Data = imageBase64.includes(',') 
          ? imageBase64.split(',')[1] 
          : imageBase64;

        // Twitter API v1.1 media upload accepte media_data en base64 via form-data
        const formData = new URLSearchParams();
        formData.append('media_data', base64Data);

        // Upload via API v1.1 (accepte OAuth 2.0 Bearer token)
        const mediaResponse = await fetch(MEDIA_UPLOAD_ENDPOINT, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        if (!mediaResponse.ok) {
          const mediaError = await mediaResponse.json();
          console.error('[X API] Media upload failed:', mediaError);
          // Continuer sans image plutôt que d'échouer complètement
        } else {
          const mediaData = await mediaResponse.json() as { media_id_string: string };
          mediaId = mediaData.media_id_string;
          console.log('[X API] Media uploaded successfully, media_id:', mediaId);
        }
      } catch (error) {
        console.error('[X API] Error uploading media:', error);
        // Continuer sans image plutôt que d'échouer complètement
      }
    }

    // Préparer le body du tweet
    const tweetBody: { text: string; media?: { media_ids: string[] } } = {
      text: truncatedText,
    };

    if (mediaId) {
      tweetBody.media = {
        media_ids: [mediaId],
      };
    }

    console.log('[X API] Posting tweet with OAuth 2.0 Bearer token...');
    console.log('[X API] Tweet text:', truncatedText);
    console.log('[X API] Has media:', !!mediaId);

    const response = await fetch(TWEET_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetBody),
    });

    const data = await response.json();

    console.log('[X API] Status:', response.status);
    console.log('[X API] Response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      return NextResponse.json({ error: data }, { status: response.status });
    }

    // Sauvegarder le post en base de données
    const tweetId = (data as { data?: { id?: string } }).data?.id;
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
