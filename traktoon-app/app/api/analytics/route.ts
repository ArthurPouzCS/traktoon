import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getXPostMetrics } from "../x/route";
import { getInstagramPostMetrics } from "@/lib/instagram/client";
import { getRedditPostMetrics } from "@/lib/reddit/client";

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

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");
    const provider = searchParams.get("provider");

    // Si un postId est fourni, récupérer les métriques d'un post spécifique
    if (postId && provider) {
      // Récupérer le post depuis la base de données
      const { data: post, error: postError } = await supabase
        .from("posts")
        .select("*")
        .eq("id", postId)
        .eq("user_id", user.id)
        .single();

      if (postError || !post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }

      // Récupérer les métriques depuis l'API du réseau social
      let metrics;
      try {
        switch (post.provider) {
          case "twitter":
            metrics = await getXPostMetrics(user.id, post.provider_post_id);
            break;
          case "instagram":
            metrics = await getInstagramPostMetrics(user.id, post.provider_post_id);
            break;
          case "reddit":
            metrics = await getRedditPostMetrics(user.id, post.provider_post_id);
            break;
          default:
            return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
        }

        // Sauvegarder les métriques dans la base de données
        const metricsData: {
          post_id: string;
          impressions: number;
          likes: number;
          comments: number;
          shares?: number;
          retweets?: number;
          upvotes?: number;
          downvotes?: number;
          engagement_rate: number;
        } = {
          post_id: post.id,
          impressions: "impressions" in metrics ? (metrics.impressions || 0) : 0,
          likes: "likes" in metrics ? (metrics.likes || 0) : 0,
          comments: "comments" in metrics ? (metrics.comments || 0) : 0,
          engagement_rate: metrics.engagement_rate || 0,
        };

        // Ajouter les métriques spécifiques selon le provider
        if ("shares" in metrics && metrics.shares !== undefined) {
          metricsData.shares = metrics.shares;
        }
        if ("retweets" in metrics && metrics.retweets !== undefined) {
          metricsData.retweets = metrics.retweets;
        }
        if ("upvotes" in metrics && metrics.upvotes !== undefined) {
          metricsData.upvotes = metrics.upvotes;
        }
        if ("downvotes" in metrics && metrics.downvotes !== undefined) {
          metricsData.downvotes = metrics.downvotes;
        }

        const { error: metricsError } = await supabase.from("post_metrics").insert(metricsData);

        if (metricsError) {
          console.error("Error saving metrics:", metricsError);
          // Continuer même si la sauvegarde échoue
        }

        return NextResponse.json({
          success: true,
          post,
          metrics,
        });
      } catch (error) {
        console.error("Error fetching metrics:", error);
        return NextResponse.json(
          {
            error: "Failed to fetch metrics",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 500 },
        );
      }
    }

    // Sinon, récupérer tous les posts de l'utilisateur avec leurs dernières métriques
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (postsError) {
      return NextResponse.json(
        { error: "Failed to fetch posts", message: postsError.message },
        { status: 500 },
      );
    }

    // Récupérer les dernières métriques pour chaque post
    const postsWithMetrics = await Promise.all(
      (posts || []).map(async (post) => {
        // Récupérer la dernière métrique enregistrée
        const { data: latestMetric } = await supabase
          .from("post_metrics")
          .select("*")
          .eq("post_id", post.id)
          .order("measured_at", { ascending: false })
          .limit(1)
          .single();

        return {
          ...post,
          latestMetrics: latestMetric || null,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      posts: postsWithMetrics,
    });
  } catch (error) {
    console.error("Error in analytics route:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
