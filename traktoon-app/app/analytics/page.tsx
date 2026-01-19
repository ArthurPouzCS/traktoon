"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface PostMetrics {
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares?: number | null;
  retweets?: number | null;
  upvotes?: number | null;
  downvotes?: number | null;
  engagement_rate: number | null;
}

interface Post {
  id: string;
  provider: string;
  provider_post_id: string;
  content: string | null;
  media_url: string | null;
  created_at: string;
  latestMetrics: PostMetrics | null;
}

const providerNames: Record<string, string> = {
  twitter: "X (Twitter)",
  instagram: "Instagram",
  reddit: "Reddit",
};

const providerColors: Record<string, { bg: string; text: string; border: string }> = {
  twitter: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
  instagram: {
    bg: "bg-pink-500/10",
    text: "text-pink-400",
    border: "border-pink-500/30",
  },
  reddit: {
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    border: "border-orange-500/30",
  },
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      setIsCheckingAuth(false);
      loadPosts();
    };

    checkAuth();
  }, [router]);

  const loadPosts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/analytics");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors du chargement des posts");
      }

      const data = await response.json();
      setPosts(data.posts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const refreshMetrics = async (postId: string, provider: string) => {
    try {
      setRefreshingIds((prev) => new Set(prev).add(postId));
      setError(null);

      const response = await fetch(`/api/analytics?postId=${postId}&provider=${provider}`);

      if (!response.ok) {
        const errorData = await response.json();
        
        // Si le post a été supprimé (404 avec deleted: true), retirer le post de la liste
        if (response.status === 404 && errorData.deleted) {
          setPosts((prev) => prev.filter((post) => post.id !== postId));
          // Ne pas afficher d'erreur, juste retirer le post silencieusement
          return;
        }
        
        // Pour les erreurs d'authentification (401), ne pas afficher d'erreur rouge
        // car ce n'est pas une erreur critique pour l'utilisateur
        if (response.status === 401 || errorData.authError) {
          // Ne pas afficher d'erreur, juste retourner silencieusement
          return;
        }
        
        // Pour les autres erreurs, afficher un message
        throw new Error(errorData.error || errorData.message || "Erreur lors de la récupération des métriques");
      }

      const data = await response.json();
      
      // Mettre à jour le post dans la liste
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, latestMetrics: data.metrics }
            : post
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erreur lors de la récupération des métriques";
      // Afficher l'erreur seulement si ce n'est pas une erreur d'authentification
      if (!errorMessage.includes("401") && !errorMessage.includes("Unauthorized") && !errorMessage.includes("Authentication failed")) {
        setError(errorMessage);
      }
    } finally {
      setRefreshingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la déconnexion");
      }

      router.push("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue lors de la déconnexion");
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined || isNaN(num)) {
      return "0";
    }
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // Afficher un loader pendant la vérification de l'authentification
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="text-zinc-400">Vérification de l'authentification...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative flex flex-col">
      <header className="w-full px-6 py-6 flex items-center justify-between border-b border-zinc-800">
        <div className="text-xl ml-2 font-semibold text-white">Traktoon</div>
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="px-4 py-2 bg-zinc-900 rounded-lg text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            Nouveau plan
          </a>
          <a
            href="/history"
            className="px-4 py-2 bg-zinc-900 rounded-lg text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            Historique
          </a>
          <a
            href="/connections"
            className="px-4 py-2 bg-zinc-900 rounded-lg text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            Connexions
          </a>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-zinc-900 rounded-lg text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            Se déconnecter
          </button>
        </div>
      </header>

      <main className="flex-1 w-full px-6 py-12">
        <div className="w-full max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Analytics des posts</h1>
            <p className="text-lg text-zinc-400">
              {posts.length} post{posts.length > 1 ? "s" : ""} publié{posts.length > 1 ? "s" : ""}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900 border border-red-700 rounded-lg text-red-100">
              <p className="font-semibold">Erreur</p>
              <p>{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              <p className="text-zinc-400">Chargement des posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl text-zinc-400 mb-4">Aucun post publié</p>
              <a
                href="/"
                className="inline-block px-6 py-3 bg-zinc-900 rounded-lg text-white font-medium hover:bg-zinc-800 transition-colors"
              >
                Créer votre premier plan
              </a>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => {
                const providerColor = providerColors[post.provider] || {
                  bg: "bg-zinc-800/50",
                  text: "text-zinc-400",
                  border: "border-zinc-700",
                };
                const metrics = post.latestMetrics;

                return (
                  <div
                    key={post.id}
                    className={`bg-zinc-900 border ${providerColor.border} rounded-lg p-6 space-y-4`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${providerColor.bg} ${providerColor.text}`}
                          >
                            {providerNames[post.provider] || post.provider}
                          </span>
                          <span className="text-zinc-400 text-sm">{formatDate(post.created_at)}</span>
                        </div>
                        {post.content && (
                          <p className="text-white text-sm line-clamp-2 mb-2">{post.content}</p>
                        )}
                        {post.media_url && (
                          <a
                            href={post.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-xs"
                          >
                            Voir le média →
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => refreshMetrics(post.id, post.provider)}
                        disabled={refreshingIds.has(post.id)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
                      >
                        {refreshingIds.has(post.id) ? "Actualisation..." : "Actualiser"}
                      </button>
                    </div>

                    {metrics ? (
                      <div className="pt-4 border-t border-zinc-800">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <p className="text-zinc-400 text-xs uppercase tracking-wide">Impressions</p>
                            <p className="text-white text-2xl font-bold">{formatNumber(metrics.impressions)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-zinc-400 text-xs uppercase tracking-wide">Likes</p>
                            <p className="text-white text-2xl font-bold">{formatNumber(metrics.likes)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-zinc-400 text-xs uppercase tracking-wide">Commentaires</p>
                            <p className="text-white text-2xl font-bold">{formatNumber(metrics.comments)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-zinc-400 text-xs uppercase tracking-wide">Engagement</p>
                            <p className="text-white text-2xl font-bold">
                              {metrics.engagement_rate !== null && metrics.engagement_rate !== undefined
                                ? metrics.engagement_rate.toFixed(2)
                                : "0.00"}
                              %
                            </p>
                          </div>
                        </div>

                        {/* Métriques spécifiques par plateforme */}
                        <div className="mt-4 pt-4 border-t border-zinc-800">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {post.provider === "twitter" && metrics.retweets !== undefined && (
                              <div className="space-y-1">
                                <p className="text-zinc-400 text-xs uppercase tracking-wide">Retweets</p>
                                <p className="text-white text-lg font-semibold">{formatNumber(metrics.retweets)}</p>
                              </div>
                            )}
                            {post.provider === "reddit" && metrics.upvotes !== undefined && (
                              <>
                                <div className="space-y-1">
                                  <p className="text-zinc-400 text-xs uppercase tracking-wide">Upvotes</p>
                                  <p className="text-white text-lg font-semibold">{formatNumber(metrics.upvotes)}</p>
                                </div>
                                {metrics.downvotes !== undefined && (
                                  <div className="space-y-1">
                                    <p className="text-zinc-400 text-xs uppercase tracking-wide">Downvotes</p>
                                    <p className="text-white text-lg font-semibold">
                                      {formatNumber(metrics.downvotes)}
                                    </p>
                                  </div>
                                )}
                              </>
                            )}
                            {post.provider === "instagram" && metrics.shares !== undefined && (
                              <div className="space-y-1">
                                <p className="text-zinc-400 text-xs uppercase tracking-wide">Partages</p>
                                <p className="text-white text-lg font-semibold">{formatNumber(metrics.shares)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-4 border-t border-zinc-800">
                        <p className="text-zinc-500 text-sm">Aucune métrique disponible. Cliquez sur "Actualiser" pour récupérer les statistiques.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
