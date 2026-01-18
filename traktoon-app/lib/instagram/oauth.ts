import crypto from "crypto";
import type {
  InstagramTokenResponse,
  InstagramLongLivedTokenResponse,
  InstagramUser,
} from "./types";

const FACEBOOK_AUTH_URL = "https://www.facebook.com/v21.0/dialog/oauth";
const FACEBOOK_TOKEN_URL = "https://graph.facebook.com/v21.0/oauth/access_token";
const FACEBOOK_GRAPH_API = "https://graph.facebook.com/v21.0";
const INSTAGRAM_GRAPH_API = "https://graph.facebook.com/v21.0";

export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getInstagramAuthUrl(state: string, redirectUri: string): string {
  const appId = process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID;
  if (!appId) {
    throw new Error("INSTAGRAM_APP_ID or FACEBOOK_APP_ID is not configured");
  }

  // Scopes Instagram nécessaires
  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
  ].join(",");

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: scopes,
    response_type: "code",
  });

  return `${FACEBOOK_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<InstagramTokenResponse> {
  const appId = process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID;
  const appSecret =
    process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("Instagram OAuth credentials are not configured");
  }

  // Étape 1 : Échanger le code contre un short-lived access token
  const tokenParams = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const tokenResponse = await fetch(`${FACEBOOK_TOKEN_URL}?${tokenParams.toString()}`);

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(
      `Failed to exchange code for token: ${tokenResponse.status} ${errorText}`,
    );
  }

  const tokenData = (await tokenResponse.json()) as InstagramTokenResponse;

  // Note: Instagram nécessite généralement un long-lived token pour les opérations
  // Le short-lived token expire en 1 heure, on peut l'échanger contre un long-lived
  return tokenData;
}

export async function exchangeShortLivedForLongLivedToken(
  shortLivedToken: string,
): Promise<InstagramLongLivedTokenResponse> {
  const appId = process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID;
  const appSecret =
    process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("Instagram OAuth credentials are not configured");
  }

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(`${FACEBOOK_TOKEN_URL}?${params.toString()}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get long-lived token: ${response.status} ${errorText}`);
  }

  return (await response.json()) as InstagramLongLivedTokenResponse;
}

export async function refreshLongLivedToken(
  longLivedToken: string,
): Promise<InstagramLongLivedTokenResponse> {
  const appId = process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID;

  if (!appId) {
    throw new Error("INSTAGRAM_APP_ID or FACEBOOK_APP_ID is not configured");
  }

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET!,
    fb_exchange_token: longLivedToken,
  });

  const response = await fetch(`${FACEBOOK_TOKEN_URL}?${params.toString()}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
  }

  return (await response.json()) as InstagramLongLivedTokenResponse;
}

export async function getInstagramAccountId(accessToken: string): Promise<string> {
  // Récupérer les pages Facebook de l'utilisateur
  const pagesResponse = await fetch(
    `${FACEBOOK_GRAPH_API}/me/accounts?access_token=${accessToken}`,
  );

  if (!pagesResponse.ok) {
    const errorText = await pagesResponse.text();
    throw new Error(`Failed to get pages: ${pagesResponse.status} ${errorText}`);
  }

  const pagesData = (await pagesResponse.json()) as {
    data: Array<{ id: string; access_token: string; instagram_business_account?: { id: string } }>;
  };

  // Trouver la page avec un compte Instagram business
  for (const page of pagesData.data) {
    if (page.instagram_business_account) {
      return page.instagram_business_account.id;
    }
  }

  throw new Error("No Instagram Business account found linked to Facebook pages");
}

export async function getInstagramUser(
  accessToken: string,
  instagramAccountId: string,
): Promise<InstagramUser> {
  const response = await fetch(
    `${INSTAGRAM_GRAPH_API}/${instagramAccountId}?fields=id,username,account_type&access_token=${accessToken}`,
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get Instagram user: ${response.status} ${errorText}`);
  }

  return (await response.json()) as InstagramUser;
}

export function calculateExpiresAt(expiresIn: number | undefined): Date | null {
  if (!expiresIn) {
    return null;
  }
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
