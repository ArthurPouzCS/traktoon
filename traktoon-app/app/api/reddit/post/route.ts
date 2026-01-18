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
        { error: "Invalid request", details: validationResult.error.errors },
        { status: 400 },
      );
    }

    const { subreddit, title, text } = validationResult.data;

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

    return NextResponse.json({
      success: true,
      post: result.json.data,
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
