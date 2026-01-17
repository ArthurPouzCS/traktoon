import { NextRequest, NextResponse } from "next/server";
import { generateOAuthState, getRedditAuthUrl } from "@/lib/reddit/oauth";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getRedditRedirectUri } from "@/lib/utils/redirect-uri";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const cookieStore = await cookies();

    // Essayer de récupérer l'utilisateur authentifié, sinon créer une session temporaire
    let userId: string;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      // Si pas d'authentification Supabase, utiliser une session temporaire
      let tempUserId = cookieStore.get("temp_user_id")?.value;
      if (!tempUserId) {
        // Créer un identifiant temporaire unique
        tempUserId = crypto.randomBytes(16).toString("hex");
        cookieStore.set("temp_user_id", tempUserId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30, // 30 jours
          path: "/",
        });
      }
      userId = tempUserId;
    } else {
      userId = user.id;
    }

    // Générer l'URL de redirection dynamiquement à partir de la base URL
    const redirectUri = process.env.REDDIT_REDIRECT_URI || getRedditRedirectUri();

    // Générer un state sécurisé
    const state = generateOAuthState();

    // Stocker le state dans un cookie httpOnly pour vérification au callback
    cookieStore.set("reddit_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    // Stocker aussi le user_id dans le cookie (ou dans le state lui-même)
    cookieStore.set("reddit_oauth_user_id", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    // Construire l'URL d'autorisation Reddit
    const authUrl = getRedditAuthUrl(state, redirectUri);

    // Rediriger vers Reddit
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Error initiating Reddit OAuth:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
