import type { InstagramPostRequest, InstagramPostResponse } from "./types";
import {
  refreshLongLivedToken,
  isTokenExpired,
  calculateExpiresAt,
  getInstagramAccountId,
  getInstagramUser,
  exchangeShortLivedForLongLivedToken,
} from "./oauth";
import { createServiceRoleClient } from "@/lib/supabase/server";

const INSTAGRAM_GRAPH_API = "https://graph.facebook.com/v21.0";

export async function getValidAccessToken(
  userId: string,
  provider: string,
): Promise<{ accessToken: string; refreshToken: string | null }> {
  const supabase = createServiceRoleClient();

  // Récupérer la connexion depuis Supabase
  const { data: connection, error: fetchError } = await supabase
    .from("social_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", provider)
    .single();

  if (fetchError || !connection) {
    throw new Error("No social connection found for user");
  }

  // Vérifier si le token est expiré
  if (isTokenExpired(connection.expires_at)) {
    if (!connection.refresh_token) {
      throw new Error("Token expired and no refresh token available");
    }

    // Rafraîchir le token long-lived (60 jours)
    const tokenResponse = await refreshLongLivedToken(connection.refresh_token);

    const newExpiresAt = calculateExpiresAt(tokenResponse.expires_in);

    // Mettre à jour dans Supabase
    const { error: updateError } = await supabase
      .from("social_connections")
      .update({
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.access_token, // Long-lived token se rafraîchit avec lui-même
        expires_at: newExpiresAt ? newExpiresAt.toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", provider);

    if (updateError) {
      throw new Error(`Failed to update token: ${updateError.message}`);
    }

    return {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.access_token,
    };
  }

  return {
    accessToken: connection.access_token,
    refreshToken: connection.refresh_token,
  };
}

export async function getInstagramAccountIdForUser(
  userId: string,
): Promise<string> {
  const { accessToken } = await getValidAccessToken(userId, "instagram");
  return await getInstagramAccountId(accessToken);
}

export async function createInstagramPost(
  userId: string,
  postData: InstagramPostRequest,
): Promise<InstagramPostResponse> {
  const { accessToken } = await getValidAccessToken(userId, "instagram");

  // Récupérer l'ID du compte Instagram Business
  const instagramAccountId = await getInstagramAccountId(accessToken);

  if (!postData.image_url) {
    throw new Error("image_url is required for Instagram posts");
  }

  // Étape 1 : Créer le conteneur média
  const containerParams = new URLSearchParams({
    image_url: postData.image_url,
    caption: postData.caption || "",
    access_token: accessToken,
  });

  if (postData.media_type) {
    containerParams.append("media_type", postData.media_type);
  }

  const containerResponse = await fetch(
    `${INSTAGRAM_GRAPH_API}/${instagramAccountId}/media?${containerParams.toString()}`,
    {
      method: "POST",
    },
  );

  if (!containerResponse.ok) {
    const errorText = await containerResponse.text();
    throw new Error(`Failed to create media container: ${containerResponse.status} ${errorText}`);
  }

  const containerData = (await containerResponse.json()) as { id: string };

  // Étape 2 : Publier le conteneur
  const publishParams = new URLSearchParams({
    creation_id: containerData.id,
    access_token: accessToken,
  });

  const publishResponse = await fetch(
    `${INSTAGRAM_GRAPH_API}/${instagramAccountId}/media_publish?${publishParams.toString()}`,
    {
      method: "POST",
    },
  );

  if (!publishResponse.ok) {
    const errorText = await publishResponse.text();
    throw new Error(`Failed to publish post: ${publishResponse.status} ${errorText}`);
  }

  const publishData = (await publishResponse.json()) as InstagramPostResponse;
  return publishData;
}

export interface InstagramPostMetrics {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  shares?: number;
  engagement_rate: number;
}

export async function getInstagramPostMetrics(
  userId: string,
  postId: string,
): Promise<InstagramPostMetrics> {
  const { accessToken } = await getValidAccessToken(userId, "instagram");

  // Récupérer les insights du post
  const insightsParams = new URLSearchParams({
    metric: "impressions,reach,likes,comments,saves",
    access_token: accessToken,
  });

  const insightsResponse = await fetch(
    `${INSTAGRAM_GRAPH_API}/${postId}/insights?${insightsParams.toString()}`,
  );

  if (!insightsResponse.ok) {
    const errorText = await insightsResponse.text();
    throw new Error(`Failed to get post insights: ${insightsResponse.status} ${errorText}`);
  }

  const insightsData = (await insightsResponse.json()) as {
    data: Array<{ name: string; values: Array<{ value: number }> }>;
  };

  // Parser les métriques
  const metrics: Partial<InstagramPostMetrics> = {
    impressions: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    engagement_rate: 0,
  };

  for (const metric of insightsData.data) {
    const value = metric.values[0]?.value || 0;
    switch (metric.name) {
      case "impressions":
        metrics.impressions = value;
        break;
      case "reach":
        metrics.reach = value;
        break;
      case "likes":
        metrics.likes = value;
        break;
      case "comments":
        metrics.comments = value;
        break;
      case "saves":
        metrics.saves = value;
        break;
      case "shares":
        metrics.shares = value;
        break;
    }
  }

  // Calculer le taux d'engagement
  const totalEngagement = metrics.likes! + metrics.comments! + (metrics.saves || 0) + (metrics.shares || 0);
  metrics.engagement_rate =
    metrics.impressions! > 0 ? (totalEngagement / metrics.impressions!) * 100 : 0;

  return metrics as InstagramPostMetrics;
}