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
        
        // Vérifier si l'erreur indique que le post n'existe plus
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const lowerErrorMessage = errorMessage.toLowerCase();
        
        // Extraire le code de statut HTTP du message d'erreur
        // Formats possibles:
        // - "Post not found: 404 ..." (nouveau format amélioré)
        // - "Failed to get tweet metrics: 404 ..."
        // - "Failed to get post insights: 404 ..."
        // - "Failed to get Reddit post: 404 ..."
        // - "Post not found" (Reddit spécifique)
        const statusMatch = errorMessage.match(/:\s*(\d{3})\s*/);
        const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : null;
        
        // Vérifier si le message indique que le post n'existe plus
        // Même si le code est 401, si le message dit "not found", c'est que le post n'existe plus
        const isPostNotFoundMessage = 
          lowerErrorMessage.includes("post not found") ||
          lowerErrorMessage.includes("not found:") ||
          lowerErrorMessage.includes("does not exist") ||
          lowerErrorMessage.includes("could not be found") ||
          lowerErrorMessage.includes("no data returned") ||
          lowerErrorMessage.trim() === "post not found";
        
        // Vérifier si c'est une erreur 404 ou un message explicite "Post not found"
        // On supprime aussi si le message indique "not found" même avec un autre code (401 peut masquer un 404)
        if (statusCode === 404 || isPostNotFoundMessage) {
          // Supprimer le post de la base de données car il n'existe plus
          const { error: deleteError } = await supabase
            .from("posts")
            .delete()
            .eq("id", post.id)
            .eq("user_id", user.id);

          if (deleteError) {
            console.error("Error deleting post:", deleteError);
            return NextResponse.json(
              {
                error: "Post not found and failed to delete from database",
                message: deleteError.message,
              },
              { status: 500 },
            );
          }

          return NextResponse.json(
            {
              error: "Post not found",
              message: "The post no longer exists and has been removed from the database",
              deleted: true,
            },
            { status: 404 },
          );
        }

        // Gérer les erreurs d'authentification (401) séparément
        // Seulement si ce n'est PAS un message "not found"
        if (statusCode === 401 && !isPostNotFoundMessage) {
          return NextResponse.json(
            {
              error: "Authentication failed",
              message: "Unable to authenticate with the social media platform. Please reconnect your account.",
              authError: true,
            },
            { status: 401 },
          );
        }

        // Pour les autres erreurs, retourner un statut 500
        return NextResponse.json(
          {
            error: "Failed to fetch metrics",
            message: errorMessage,
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
