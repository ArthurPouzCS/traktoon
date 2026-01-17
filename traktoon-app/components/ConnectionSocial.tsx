"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SocialProvider, SocialProviderConfig, SocialConnectionPublic } from "@/types/social";
import Image from "next/image";

const SOCIAL_PROVIDERS: SocialProviderConfig[] = [
  {
    id: "reddit",
    name: "Reddit",
    logo: "/logos/reddit.png",
    enabled: true,
    description: "Connectez votre compte Reddit pour publier des posts",
  },
  {
    id: "twitter",
    name: "Twitter/X",
    logo: "/logos/twitter.png",
    enabled: false,
    description: "Bientôt disponible",
  },
  {
    id: "instagram",
    name: "Instagram",
    logo: "/logos/instagram.png",
    enabled: true,
    description: "Connectez votre compte Instagram Business pour publier des posts",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    logo: "/logos/linkedin.png",
    enabled: false,
    description: "Bientôt disponible",
  },
  {
    id: "facebook",
    name: "Facebook",
    logo: "/logos/facebook.png",
    enabled: false,
    description: "Bientôt disponible",
  },
  {
    id: "tiktok",
    name: "TikTok",
    logo: "/logos/tiktok.png",
    enabled: false,
    description: "Bientôt disponible",
  },
  {
    id: "youtube",
    name: "YouTube",
    logo: "/logos/youtube.png",
    enabled: false,
    description: "Bientôt disponible",
  },
];

export const ConnectionSocial = () => {
  const [connections, setConnections] = useState<SocialConnectionPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<SocialProvider | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setLoading(false);
        return;
      }

      const response = await fetch("/api/auth/social");
      if (response.ok) {
        const data = (await response.json()) as { connections: SocialConnectionPublic[] };
        setConnections(data.connections);
      }
    } catch (error) {
      console.error("Error loading connections:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (provider: SocialProvider) => {
    if (provider !== "reddit" && provider !== "instagram") {
      return; // Seuls Reddit et Instagram sont actifs pour l'instant
    }

    setConnecting(provider);
    try {
      // Rediriger vers la route d'initiation OAuth
      const route = provider === "reddit" ? "/api/auth/reddit/initiate" : "/api/auth/instagram/initiate";
      window.location.href = route;
    } catch (error) {
      console.error("Error connecting:", error);
      setConnecting(null);
    }
  };

  const handleDisconnect = async (provider: SocialProvider) => {
    // TODO: Implémenter la déconnexion
    console.log("Disconnect not implemented yet for", provider);
  };

  const isConnected = (provider: SocialProvider): boolean => {
    return connections.some((conn) => conn.provider === provider);
  };

  const getConnectionUsername = (provider: SocialProvider): string | null => {
    const connection = connections.find((conn) => conn.provider === provider);
    return connection?.provider_username || null;
  };

  // Vérifier les messages de succès/erreur depuis l'URL
  useEffect(() => {
    if (typeof window === "undefined") return;

    const searchParams = new URLSearchParams(window.location.search);
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "reddit_connected" || success === "instagram_connected") {
      loadConnections();
      // Nettoyer l'URL
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (error) {
      console.error("OAuth error:", error);
      // Nettoyer l'URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Connexions réseaux sociaux</h1>
        <p className="text-zinc-400">
          Connectez vos comptes pour publier directement depuis Traktoon
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SOCIAL_PROVIDERS.map((provider) => {
          const connected = isConnected(provider);
          const username = getConnectionUsername(provider.id);
          const isConnecting = connecting === provider.id;

          return (
            <div
              key={provider.id}
              className={`bg-zinc-900 border rounded-xl p-6 space-y-4 transition-all duration-300 ${
                provider.enabled
                  ? "border-zinc-800 hover:border-zinc-700"
                  : "border-zinc-900 opacity-60 cursor-not-allowed"
              }`}
            >
              {/* Logo et nom */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center overflow-hidden">
                  {provider.logo ? (
                    <Image
                      src={provider.logo}
                      alt={provider.name}
                      width={48}
                      height={48}
                      className="object-contain"
                      onError={(e) => {
                        // Fallback si l'image n'existe pas
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = provider.name.charAt(0).toUpperCase();
                          parent.className += " text-white font-bold text-xl";
                        }
                      }}
                    />
                  ) : (
                    <span className="text-white font-bold text-xl">
                      {provider.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{provider.name}</h3>
                  {connected && username && (
                    <p className="text-sm text-zinc-400">@{username}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-zinc-400">{provider.description}</p>

              {/* État de connexion */}
              {connected ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-400 font-medium">Connecté</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-zinc-600 rounded-full"></div>
                  <span className="text-sm text-zinc-500">Non connecté</span>
                </div>
              )}

              {/* Bouton d'action */}
              {provider.enabled ? (
                <button
                  onClick={() => (connected ? handleDisconnect(provider.id) : handleConnect(provider.id))}
                  disabled={isConnecting}
                  className={`w-full py-2.5 px-4 rounded-lg font-medium transition-colors ${
                    connected
                      ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                      : "bg-zinc-800 text-white border border-zinc-700 hover:bg-zinc-700"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isConnecting
                    ? "Connexion..."
                    : connected
                      ? "Déconnecter"
                      : "Connecter"}
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-2.5 px-4 rounded-lg font-medium bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed"
                >
                  Bientôt disponible
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
