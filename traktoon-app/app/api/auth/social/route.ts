import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SocialConnectionPublic } from "@/types/social";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    // Vérifier que l'utilisateur est authentifié
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Récupérer les connexions sociales de l'utilisateur
    const { data: connections, error: fetchError } = await supabase
      .from("social_connections")
      .select("provider, provider_username, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Error fetching social connections:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch connections" },
        { status: 500 },
      );
    }

    const publicConnections: SocialConnectionPublic[] = (connections || []).map((conn) => ({
      provider: conn.provider,
      provider_username: conn.provider_username,
      created_at: conn.created_at,
    }));

    return NextResponse.json({ connections: publicConnections });
  } catch (error) {
    console.error("Error in GET /api/auth/social:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
