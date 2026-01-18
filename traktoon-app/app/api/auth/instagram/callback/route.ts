import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  exchangeShortLivedForLongLivedToken,
  getInstagramAccountId,
  getInstagramUser,
  calculateExpiresAt,
} from "@/lib/instagram/oauth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getInstagramRedirectUri } from "@/lib/utils/redirect-uri";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Vérifier s'il y a une erreur de Facebook/Instagram
  if (error) {
    const errorUrl = new URL(request.nextUrl.origin);
    errorUrl.pathname = "/connections";
    errorUrl.searchParams.set("error", error);
    return NextResponse.redirect(errorUrl.toString());
  }

  if (!code || !state) {
    const errorUrl = new URL(request.nextUrl.origin);
    errorUrl.pathname = "/connections";
    errorUrl.searchParams.set("error", "missing_code_or_state");
    return NextResponse.redirect(errorUrl.toString());
  }

  try {
    const cookieStore = await cookies();
    const storedState = cookieStore.get("instagram_oauth_state")?.value;
    const userId = cookieStore.get("instagram_oauth_user_id")?.value;

    // Vérifier le state (protection CSRF)
    if (!storedState || storedState !== state) {
      const errorUrl = new URL(request.nextUrl.origin);
      errorUrl.pathname = "/connections";
      errorUrl.searchParams.set("error", "invalid_state");
      return NextResponse.redirect(errorUrl.toString());
    }

    if (!userId) {
      const errorUrl = new URL(request.nextUrl.origin);
      errorUrl.pathname = "/connections";
      errorUrl.searchParams.set("error", "user_not_found");
      return NextResponse.redirect(errorUrl.toString());
    }

    // Générer l'URL de redirection dynamiquement à partir de la base URL
    const redirectUri =
      process.env.INSTAGRAM_REDIRECT_URI ||
      process.env.FACEBOOK_REDIRECT_URI ||
      getInstagramRedirectUri();

    // Étape 1 : Échanger le code contre un short-lived token
    const shortLivedTokenResponse = await exchangeCodeForToken(code, redirectUri);

    // Étape 2 : Échanger le short-lived token contre un long-lived token (60 jours)
    const longLivedTokenResponse = await exchangeShortLivedForLongLivedToken(
      shortLivedTokenResponse.access_token,
    );

    // Étape 3 : Récupérer l'ID du compte Instagram Business
    const instagramAccountId = await getInstagramAccountId(longLivedTokenResponse.access_token);

    // Étape 4 : Récupérer les infos utilisateur Instagram
    const instagramUser = await getInstagramUser(
      longLivedTokenResponse.access_token,
      instagramAccountId,
    );

    // Calculer la date d'expiration (long-lived token expire en 60 jours)
    const expiresAt = calculateExpiresAt(longLivedTokenResponse.expires_in);

    // Stocker dans Supabase
    const supabase = createServiceRoleClient();

    const { error: upsertError } = await supabase.from("social_connections").upsert(
      {
        user_id: userId,
        provider: "instagram",
        access_token: longLivedTokenResponse.access_token,
        refresh_token: longLivedTokenResponse.access_token, // Long-lived token peut être utilisé pour refresh
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
        provider_user_id: instagramUser.id,
        provider_username: instagramUser.username,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,provider",
      },
    );

    if (upsertError) {
      console.error("Error storing Instagram connection:", upsertError);
      const errorUrl = new URL(request.nextUrl.origin);
      errorUrl.pathname = "/connections";
      errorUrl.searchParams.set("error", "storage_error");
      return NextResponse.redirect(errorUrl.toString());
    }

    // Nettoyer les cookies OAuth
    cookieStore.delete("instagram_oauth_state");
    cookieStore.delete("instagram_oauth_user_id");

    // Rediriger vers la page de connexions avec succès
    const successUrl = new URL(request.nextUrl.origin);
    successUrl.pathname = "/connections";
    successUrl.searchParams.set("success", "instagram_connected");
    return NextResponse.redirect(successUrl.toString());
  } catch (error) {
    console.error("Error in Instagram OAuth callback:", error);
    const errorUrl = new URL(request.nextUrl.origin);
    errorUrl.pathname = "/connections";
    errorUrl.searchParams.set(
      "error",
      error instanceof Error ? error.message : "unknown_error",
    );
    return NextResponse.redirect(errorUrl.toString());
  }
}
