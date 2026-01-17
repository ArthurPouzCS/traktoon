import crypto from "crypto";
import type { RedditTokenResponse } from "./types";

const REDDIT_AUTH_URL = "https://www.reddit.com/api/v1/authorize";
const REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const REDDIT_API_BASE = "https://oauth.reddit.com";

export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getRedditAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.REDDIT_CLIENT_ID;
  if (!clientId) {
    throw new Error("REDDIT_CLIENT_ID is not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    state,
    redirect_uri: redirectUri,
    duration: "permanent",
    scope: "identity submit read",
  });

  return `${REDDIT_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<RedditTokenResponse> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Reddit OAuth credentials are not configured");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(REDDIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.REDDIT_USER_AGENT || "Traktoon/1.0",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange code for token: ${response.status} ${errorText}`);
  }

  return (await response.json()) as RedditTokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<RedditTokenResponse> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Reddit OAuth credentials are not configured");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(REDDIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.REDDIT_USER_AGENT || "Traktoon/1.0",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
  }

  return (await response.json()) as RedditTokenResponse;
}

export async function getRedditUser(accessToken: string): Promise<{ id: string; name: string }> {
  const response = await fetch(`${REDDIT_API_BASE}/api/v1/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": process.env.REDDIT_USER_AGENT || "Traktoon/1.0",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get Reddit user: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { id: string; name: string };
  return { id: data.id, name: data.name };
}

export function calculateExpiresAt(expiresIn: number): Date {
  // Soustraire 5 minutes pour avoir une marge de sécurité
  return new Date(Date.now() + (expiresIn - 300) * 1000);
}

export function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return true;
  }
  const expirationDate = new Date(expiresAt);
  const now = new Date();
  // Considérer comme expiré si moins de 5 minutes restantes
  return expirationDate.getTime() - now.getTime() < 5 * 60 * 1000;
}
