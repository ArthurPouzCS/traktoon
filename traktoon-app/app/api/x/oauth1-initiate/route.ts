import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getRedirectUri } from "@/lib/utils/redirect-uri";
import { buildOAuth1Header } from "@/lib/x/oauth1";

const REQUEST_TOKEN_URL = "https://api.twitter.com/oauth/request_token";
const AUTHORIZE_URL = "https://api.twitter.com/oauth/authorize";

const OAUTH1_CONSUMER_KEY = process.env.X_OAUTH1_CONSUMER_KEY;
const OAUTH1_CONSUMER_SECRET = process.env.X_OAUTH1_CONSUMER_SECRET;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    if (!OAUTH1_CONSUMER_KEY || !OAUTH1_CONSUMER_SECRET) {
      return NextResponse.json(
        { error: "X_OAUTH1_CONSUMER_KEY or X_OAUTH1_CONSUMER_SECRET is not configured" },
        { status: 500 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      const loginUrl = new URL(getRedirectUri("/login"));
      loginUrl.searchParams.set("redirect", "/connections");
      return NextResponse.redirect(loginUrl.toString());
    }

    const userId = user.id;
    const cookieStore = await cookies();

    const callbackUrl = getRedirectUri("/api/x/oauth1-callback");
    // Debug pour vérifier qu'on utilise bien la base URL (ngrok, Vercel, etc.)
    if (process.env.NODE_ENV !== "production") {
      console.log("[X OAuth1] Using callback URL:", callbackUrl);
    }

    const bodyParams: Record<string, string> = {
      oauth_callback: callbackUrl,
    };

    const { authorizationHeader } = buildOAuth1Header(
      {
        consumerKey: OAUTH1_CONSUMER_KEY,
        consumerSecret: OAUTH1_CONSUMER_SECRET,
      },
      {
        method: "POST",
        url: REQUEST_TOKEN_URL,
        bodyParams,
      },
    );

    const tokenResponse = await fetch(REQUEST_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: authorizationHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(bodyParams).toString(),
    });

    const responseText = await tokenResponse.text();

    if (!tokenResponse.ok) {
      console.error("[X OAuth1] Request token failed:", responseText);
      const errorUrl = new URL(getRedirectUri("/connections"));
      errorUrl.searchParams.set("error", "x_oauth1_request_token_failed");
      return NextResponse.redirect(errorUrl.toString());
    }

    const parsed = new URLSearchParams(responseText);
    const oauthToken = parsed.get("oauth_token");
    const oauthTokenSecret = parsed.get("oauth_token_secret");
    const callbackConfirmed = parsed.get("oauth_callback_confirmed");

    if (!oauthToken || !oauthTokenSecret || callbackConfirmed !== "true") {
      console.error("[X OAuth1] Invalid request token response:", responseText);
      const errorUrl = new URL(getRedirectUri("/connections"));
      errorUrl.searchParams.set("error", "x_oauth1_invalid_request_token_response");
      return NextResponse.redirect(errorUrl.toString());
    }

    cookieStore.set("x_oauth1_tmp", JSON.stringify({ userId, oauthTokenSecret }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    const authorizeUrl = new URL(AUTHORIZE_URL);
    authorizeUrl.searchParams.set("oauth_token", oauthToken);

    return NextResponse.redirect(authorizeUrl.toString());
  } catch (error) {
    console.error("[X OAuth1] Error initiating OAuth1 flow:", error);
    const errorUrl = new URL(getRedirectUri("/connections"));
    errorUrl.searchParams.set("error", "x_oauth1_internal_error");
    return NextResponse.redirect(errorUrl.toString());
  }
}

