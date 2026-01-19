import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getRedirectUri } from "@/lib/utils/redirect-uri";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { buildOAuth1Header } from "@/lib/x/oauth1";

const ACCESS_TOKEN_URL = "https://api.twitter.com/oauth/access_token";

const OAUTH1_CONSUMER_KEY = process.env.X_OAUTH1_CONSUMER_KEY;
const OAUTH1_CONSUMER_SECRET = process.env.X_OAUTH1_CONSUMER_SECRET;

interface OAuth1TmpCookie {
  userId: string;
  oauthTokenSecret: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    if (!OAUTH1_CONSUMER_KEY || !OAUTH1_CONSUMER_SECRET) {
      const errorUrl = new URL(getRedirectUri("/connections"));
      errorUrl.searchParams.set("error", "x_oauth1_not_configured");
      return NextResponse.redirect(errorUrl.toString());
    }

    const searchParams = request.nextUrl.searchParams;
    const oauthToken = searchParams.get("oauth_token");
    const oauthVerifier = searchParams.get("oauth_verifier");

    if (!oauthToken || !oauthVerifier) {
      const errorUrl = new URL(getRedirectUri("/connections"));
      errorUrl.searchParams.set("error", "x_oauth1_missing_params");
      return NextResponse.redirect(errorUrl.toString());
    }

    const cookieStore = await cookies();
    const tmpCookieRaw = cookieStore.get("x_oauth1_tmp")?.value;

    if (!tmpCookieRaw) {
      const errorUrl = new URL(getRedirectUri("/connections"));
      errorUrl.searchParams.set("error", "x_oauth1_missing_tmp_cookie");
      return NextResponse.redirect(errorUrl.toString());
    }

    let tmp: OAuth1TmpCookie;
    try {
      tmp = JSON.parse(tmpCookieRaw) as OAuth1TmpCookie;
    } catch (parseError) {
      console.error("[X OAuth1] Failed to parse tmp cookie:", parseError);
      const errorUrl = new URL(getRedirectUri("/connections"));
      errorUrl.searchParams.set("error", "x_oauth1_invalid_tmp_cookie");
      return NextResponse.redirect(errorUrl.toString());
    }

    const { userId, oauthTokenSecret } = tmp;

    const bodyParams: Record<string, string> = {
      oauth_verifier: oauthVerifier,
    };

    const { authorizationHeader } = buildOAuth1Header(
      {
        consumerKey: OAUTH1_CONSUMER_KEY,
        consumerSecret: OAUTH1_CONSUMER_SECRET,
        token: oauthToken,
        tokenSecret: oauthTokenSecret,
      },
      {
        method: "POST",
        url: ACCESS_TOKEN_URL,
        bodyParams,
      },
    );

    const accessTokenResponse = await fetch(ACCESS_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: authorizationHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(bodyParams).toString(),
    });

    const responseText = await accessTokenResponse.text();

    if (!accessTokenResponse.ok) {
      console.error("[X OAuth1] Access token failed:", responseText);
      const errorUrl = new URL(getRedirectUri("/connections"));
      errorUrl.searchParams.set("error", "x_oauth1_access_token_failed");
      return NextResponse.redirect(errorUrl.toString());
    }

    const parsed = new URLSearchParams(responseText);
    const oauthTokenFinal = parsed.get("oauth_token");
    const oauthTokenSecretFinal = parsed.get("oauth_token_secret");
    const userIdOnX = parsed.get("user_id");
    const screenName = parsed.get("screen_name");

    if (!oauthTokenFinal || !oauthTokenSecretFinal) {
      console.error("[X OAuth1] Invalid access token response:", responseText);
      const errorUrl = new URL(getRedirectUri("/connections"));
      errorUrl.searchParams.set("error", "x_oauth1_invalid_access_token_response");
      return NextResponse.redirect(errorUrl.toString());
    }

    const supabase = createServiceRoleClient();
    const { error: upsertError } = await supabase.from("social_connections").upsert(
      {
        user_id: userId,
        provider: "twitter",
        // Garder les champs OAuth2 existants intacts si présents
        oauth1_access_token: oauthTokenFinal,
        oauth1_access_token_secret: oauthTokenSecretFinal,
        provider_user_id: userIdOnX,
        provider_username: screenName,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,provider",
      },
    );

    if (upsertError) {
      console.error("[X OAuth1] Error storing OAuth1 tokens in Supabase:", upsertError);
      const errorUrl = new URL(getRedirectUri("/connections"));
      errorUrl.searchParams.set("error", "x_oauth1_storage_error");
      return NextResponse.redirect(errorUrl.toString());
    }

    cookieStore.delete("x_oauth1_tmp");

    const successUrl = new URL(getRedirectUri("/connections"));
    successUrl.searchParams.set("success", "x_oauth1_connected");
    return NextResponse.redirect(successUrl.toString());
  } catch (error) {
    console.error("[X OAuth1] Callback error:", error);
    const errorUrl = new URL(getRedirectUri("/connections"));
    errorUrl.searchParams.set("error", "x_oauth1_internal_error");
    return NextResponse.redirect(errorUrl.toString());
  }
}

