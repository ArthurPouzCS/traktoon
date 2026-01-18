import { NextRequest, NextResponse } from "next/server";
import { createInstagramPost } from "@/lib/instagram/client";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const postSchema = z.object({
  image_url: z.string().url("Invalid image URL"),
  caption: z.string().optional(),
  media_type: z.enum(["IMAGE", "CAROUSEL_ALBUM", "VIDEO"]).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
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

    // Valider le body
    const body = await request.json();
    const validationResult = postSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validationResult.error.issues },
        { status: 400 },
      );
    }

    const { image_url, caption, media_type } = validationResult.data;
    const { planId } = body;

    // Vérifier que l'utilisateur a une connexion Instagram
    const { data: connection, error: connectionError } = await supabase
      .from("social_connections")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "instagram")
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        {
          error: "Instagram connection not found. Please connect your Instagram account first.",
        },
        { status: 404 },
      );
    }

    // Créer le post
    const result = await createInstagramPost(user.id, {
      image_url,
      caption,
      media_type,
    });

    // Sauvegarder le post en base de données
    
    if (result.id) {
      try {
        const { error: insertError } = await supabase
          .from("posts")
          .insert({
            user_id: user.id,
            provider: "instagram",
            provider_post_id: result.id,
            content: caption || "",
            media_url: image_url,
            plan_id: planId || null,
          });

        if (insertError) {
          console.error("[Instagram API] Error saving post to database:", insertError);
          // Ne pas faire échouer la requête si la sauvegarde échoue
        }
      } catch (dbError) {
        console.error("[Instagram API] Error saving post to database:", dbError);
        // Ne pas faire échouer la requête si la sauvegarde échoue
      }
    }

    return NextResponse.json({
      success: true,
      post: result,
      postId: result.id,
    });
  } catch (error) {
    console.error("Error creating Instagram post:", error);
    return NextResponse.json(
      {
        error: "Failed to create post",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
