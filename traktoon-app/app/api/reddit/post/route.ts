import { NextRequest, NextResponse } from "next/server";
import { createRedditPost } from "@/lib/reddit/client";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const postSchema = z.object({
  subreddit: z.string().min(1, "Subreddit is required"),
  title: z.string().min(1, "Title is required").max(300, "Title too long"),
  text: z.string().min(1, "Text is required"),
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

    const { subreddit, title, text } = validationResult.data;
    const { planId } = body;

    // Vérifier que l'utilisateur a une connexion Reddit
    const { data: connection, error: connectionError } = await supabase
      .from("social_connections")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "reddit")
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: "Reddit connection not found. Please connect your Reddit account first." },
        { status: 404 },
      );
    }

    // Créer le post
    const result = await createRedditPost(user.id, { subreddit, title, text });

    // Vérifier s'il y a des erreurs dans la réponse Reddit
    if (result.json.errors && result.json.errors.length > 0) {
      const errorMessages = result.json.errors.map((error) => error.join(": ")).join(", ");
      return NextResponse.json(
        { error: "Failed to create post", details: errorMessages },
        { status: 400 },
      );
    }

    // Sauvegarder le post en base de données
    const redditPostId = result.json.data?.id || result.json.data?.name;

    if (redditPostId) {
      try {
        const { error: insertError } = await supabase
          .from("posts")
          .insert({
            user_id: user.id,
            provider: "reddit",
            provider_post_id: redditPostId,
            content: `${title}\n\n${text}`,
            plan_id: planId || null,
          });

        if (insertError) {
          console.error("[Reddit API] Error saving post to database:", insertError);
          // Ne pas faire échouer la requête si la sauvegarde échoue
        }
      } catch (dbError) {
        console.error("[Reddit API] Error saving post to database:", dbError);
        // Ne pas faire échouer la requête si la sauvegarde échoue
      }
    }

    return NextResponse.json({
      success: true,
      post: result.json.data,
      postId: redditPostId,
    });
  } catch (error) {
    console.error("Error creating Reddit post:", error);
    return NextResponse.json(
      {
        error: "Failed to create post",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
