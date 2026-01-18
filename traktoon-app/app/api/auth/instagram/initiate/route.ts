import { NextRequest, NextResponse } from "next/server";
import { generateOAuthState, getInstagramAuthUrl } from "@/lib/instagram/oauth";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getInstagramRedirectUri } from "@/lib/utils/redirect-uri";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const cookieStore = await cookies();

    // Vérifier que l'utilisateur est authentifié
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      // Rediriger vers la page de login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', '/api/auth/instagram/initiate');
      return NextResponse.redirect(loginUrl.toString());
    }

    const userId = user.id;

    // Générer l'URL de redirection dynamiquement à partir de la base URL
    const redirectUri =
      process.env.INSTAGRAM_REDIRECT_URI ||
      process.env.FACEBOOK_REDIRECT_URI ||
      getInstagramRedirectUri();

    // Générer un state sécurisé
    const state = generateOAuthState();

    // Stocker le state dans un cookie httpOnly pour vérification au callback
    cookieStore.set("instagram_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    // Stocker aussi le user_id dans le cookie
    cookieStore.set("instagram_oauth_user_id", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    // Vérifier que l'APP_ID est configuré avant de continuer
    const appId = process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID;
    if (!appId) {
      return NextResponse.json(
        {
          error: "INSTAGRAM_APP_ID or FACEBOOK_APP_ID is not configured",
          hint: "Vérifiez que vous avez créé le fichier .env.local avec INSTAGRAM_APP_ID=votre_app_id",
        },
        { status: 500 },
      );
    }

    // Construire l'URL d'autorisation Instagram/Facebook
    const authUrl = getInstagramAuthUrl(state, redirectUri);

    // Rediriger vers Facebook/Instagram
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Error initiating Instagram OAuth:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
