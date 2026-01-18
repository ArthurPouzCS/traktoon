import type { RedditPostRequest, RedditPostResponse } from "./types";
import {
  refreshAccessToken,
  isTokenExpired,
  calculateExpiresAt,
  getRedditUser,
} from "./oauth";
import { createServiceRoleClient } from "@/lib/supabase/server";

const REDDIT_API_BASE = "https://oauth.reddit.com";

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

    // Rafraîchir le token
    const tokenResponse = await refreshAccessToken(connection.refresh_token);

    const newExpiresAt = calculateExpiresAt(tokenResponse.expires_in);

    // Mettre à jour dans Supabase
    const { error: updateError } = await supabase
      .from("social_connections")
      .update({
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token || connection.refresh_token,
        expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", provider);

    if (updateError) {
      throw new Error(`Failed to update token: ${updateError.message}`);
    }

    return {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || connection.refresh_token,
    };
  }

  return {
    accessToken: connection.access_token,
    refreshToken: connection.refresh_token,
  };
}

export async function createRedditPost(
  userId: string,
  postData: RedditPostRequest,
): Promise<RedditPostResponse> {
  const { accessToken } = await getValidAccessToken(userId, "reddit");

  const userAgent = process.env.REDDIT_USER_AGENT || "Traktoon/1.0";

  const formData = new URLSearchParams({
    kind: "self",
    sr: postData.subreddit,
    title: postData.title,
    text: postData.text,
  });

  const response = await fetch(`${REDDIT_API_BASE}/api/submit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": userAgent,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create Reddit post: ${response.status} ${errorText}`);
  }

  return (await response.json()) as RedditPostResponse;
}
