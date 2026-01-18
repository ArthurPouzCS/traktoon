import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, getRedditUser, calculateExpiresAt } from "@/lib/reddit/oauth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getRedditRedirectUri } from "@/lib/utils/redirect-uri";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Vérifier s'il y a une erreur de Reddit
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
    const storedState = cookieStore.get("reddit_oauth_state")?.value;
    const userId = cookieStore.get("reddit_oauth_user_id")?.value;

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
    const redirectUri = process.env.REDDIT_REDIRECT_URI || getRedditRedirectUri();

    // Échanger le code contre des tokens
    const tokenResponse = await exchangeCodeForToken(code, redirectUri);

    // Récupérer les infos utilisateur Reddit
    const redditUser = await getRedditUser(tokenResponse.access_token);

    // Calculer la date d'expiration
    const expiresAt = calculateExpiresAt(tokenResponse.expires_in);

    // Stocker dans Supabase
    const supabase = createServiceRoleClient();

    const { error: upsertError } = await supabase.from("social_connections").upsert(
      {
        user_id: userId,
        provider: "reddit",
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token || null,
        expires_at: expiresAt.toISOString(),
        scope: tokenResponse.scope,
        provider_user_id: redditUser.id,
        provider_username: redditUser.name,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,provider",
      },
    );

    if (upsertError) {
      console.error("Error storing Reddit connection:", upsertError);
      const errorUrl = new URL(request.nextUrl.origin);
      errorUrl.pathname = "/connections";
      errorUrl.searchParams.set("error", "storage_error");
      return NextResponse.redirect(errorUrl.toString());
    }

    // Nettoyer les cookies OAuth
    cookieStore.delete("reddit_oauth_state");
    cookieStore.delete("reddit_oauth_user_id");

    // Rediriger vers la page de connexions avec succès
    const successUrl = new URL(request.nextUrl.origin);
    successUrl.pathname = "/connections";
    successUrl.searchParams.set("success", "reddit_connected");
    return NextResponse.redirect(successUrl.toString());
  } catch (error) {
    console.error("Error in Reddit OAuth callback:", error);
    const errorUrl = new URL(request.nextUrl.origin);
    errorUrl.pathname = "/connections";
    errorUrl.searchParams.set(
      "error",
      error instanceof Error ? error.message : "unknown_error",
    );
    return NextResponse.redirect(errorUrl.toString());
  }
}
