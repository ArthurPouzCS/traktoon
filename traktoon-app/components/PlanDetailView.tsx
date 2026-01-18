"use client";

import { useState } from "react";
import type { DetailedPlan } from "@/types/detailed-plan";
import { useCountdown, copyToClipboard } from "@/lib/utils/detailed-plan";
import type { ChannelPlan } from "@/types/plan";

interface PostCountdownProps {
  scheduledDate: string;
}

const PostCountdown = ({ scheduledDate }: Readonly<PostCountdownProps>) => {
  const countdown = useCountdown(scheduledDate);
  return <span className="text-gray-900 font-semibold">{countdown}</span>;
};

export interface PlanDetailViewProps {
  detailedPlan: DetailedPlan;
  channelPlan: ChannelPlan;
  onFlipBack: () => void;
}

const channelColors: Record<string, { accent: string; light: string }> = {
  X: { accent: "text-blue-400", light: "bg-blue-500/10" },
  Instagram: { accent: "text-pink-400", light: "bg-pink-500/10" },
  TikTok: { accent: "text-cyan-400", light: "bg-cyan-500/10" },
  Email: { accent: "text-purple-400", light: "bg-purple-500/10" },
  LinkedIn: { accent: "text-indigo-400", light: "bg-indigo-500/10" },
  GoogleAds: { accent: "text-red-400", light: "bg-red-500/10" },
  LandingPage: { accent: "text-orange-400", light: "bg-orange-500/10" },
};

export const PlanDetailView = ({ detailedPlan, channelPlan, onFlipBack }: Readonly<PlanDetailViewProps>) => {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [loadingImages, setLoadingImages] = useState<Record<number, boolean>>({});
  const [imageErrors, setImageErrors] = useState<Record<number, string>>({});
  const [executingPosts, setExecutingPosts] = useState<Record<number, boolean>>({});
  const [executedPosts, setExecutedPosts] = useState<Record<number, boolean>>({});
  const [executeErrors, setExecuteErrors] = useState<Record<number, string>>({});
  const channelColor = channelColors[channelPlan.channel] || {
    accent: "text-gray-900",
    light: "bg-gray-300/50",
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await copyToClipboard(text);
      setCopiedText(id);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (error) {
      console.error("Erreur lors de la copie:", error);
    }
  };

  const handleGenerateImage = async (postIndex: number, description: string) => {
    setLoadingImages((prev) => ({ ...prev, [postIndex]: true }));
    setImageErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[postIndex];
      return newErrors;
    });

    try {
      const response = await fetch("/api/gemini/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ description }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la génération de l'image");
      }

      const data = await response.json();
      setGeneratedImages((prev) => ({
        ...prev,
        [postIndex]: `data:image/png;base64,${data.image}`,
      }));
    } catch (error) {
      console.error("Erreur lors de la génération de l'image:", error);
      setImageErrors((prev) => ({
        ...prev,
        [postIndex]: error instanceof Error ? error.message : "Erreur inconnue",
      }));
    } finally {
      setLoadingImages((prev) => ({ ...prev, [postIndex]: false }));
    }
  };

  const handleDownloadImage = (postIndex: number) => {
    const imageData = generatedImages[postIndex];
    if (!imageData) return;

    const link = document.createElement("a");
    link.href = imageData;
    link.download = `image-post-${postIndex + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExecutePost = async (postIndex: number, post: typeof detailedPlan.posts[0]) => {
    // Uniquement pour X
    if (channelPlan.channel !== "X") {
      return;
    }

    setExecutingPosts((prev) => ({ ...prev, [postIndex]: true }));
    setExecuteErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[postIndex];
      return newErrors;
    });

    try {
      // Construire le texte avec hashtags
      const hashtagsText = post.hashtags && post.hashtags.length > 0
        ? ` ${post.hashtags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ")}`
        : "";
      const fullText = `${post.postDescription}${hashtagsText}`.trim();

      // Récupérer l'image si elle existe (enlever le préfixe data:image/png;base64,)
      const imageData = generatedImages[postIndex];
      const imageBase64 = imageData
        ? imageData.includes(",")
          ? imageData.split(",")[1]
          : imageData
        : undefined;

      const response = await fetch("/api/x", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: fullText,
          imageBase64,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.error || errorData.error || "Erreur lors de la publication du tweet");
      }

      const data = await response.json();
      setExecutedPosts((prev) => ({ ...prev, [postIndex]: true }));
      console.log("Tweet publié avec succès:", data);
    } catch (error) {
      console.error("Erreur lors de l'exécution du post:", error);
      setExecuteErrors((prev) => ({
        ...prev,
        [postIndex]: error instanceof Error ? error.message : "Erreur inconnue",
      }));
    } finally {
      setExecutingPosts((prev) => ({ ...prev, [postIndex]: false }));
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

  return (
    <div className="relative bg-gray-100 border border-gray-300 rounded-xl p-8 space-y-8 h-full overflow-y-auto">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center justify-center w-12 h-12 rounded-full ${channelColor.light} ${channelColor.accent} font-bold text-xl`}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Plan détaillé - {channelPlan.channel}</h3>
            <p className="text-sm text-gray-600 mt-1">Vue actionnable</p>
          </div>
        </div>
        <button
          onClick={onFlipBack}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-800 rounded-lg text-sm font-medium text-white transition-colors"
        >
          Retour
        </button>
      </div>

      {/* Account Setup Section */}
      <div className="space-y-4 pt-4 border-t border-gray-300">
        <h4 className="text-lg font-semibold text-gray-900 uppercase tracking-wide">Configuration du compte</h4>
        
        <div className="space-y-3 bg-white/60 rounded-lg p-4 border border-gray-200">
          <div className="space-y-2">
            <span className="text-xs text-gray-600 uppercase tracking-wide">URL d'inscription</span>
            <div className="flex items-center gap-2">
              <a
                href={detailedPlan.accountSetup.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 underline break-all flex-1"
              >
                {detailedPlan.accountSetup.registrationUrl}
              </a>
              <svg
                className="w-4 h-4 text-gray-600 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs text-gray-600 uppercase tracking-wide">Nom suggéré pour le compte</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-900">{detailedPlan.accountSetup.accountName}</span>
              <button
                onClick={() => handleCopy(detailedPlan.accountSetup.accountName, "account-name")}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  copiedText === "account-name"
                    ? "bg-green-500/20 text-green-700"
                    : "bg-gray-300 hover:bg-gray-400 text-gray-700"
                }`}
              >
                {copiedText === "account-name" ? "✓ Copié" : "Copier"}
              </button>
            </div>
          </div>

          {detailedPlan.accountSetup.steps && detailedPlan.accountSetup.steps.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-gray-600 uppercase tracking-wide">Étapes de création</span>
              <ul className="space-y-2">
                {detailedPlan.accountSetup.steps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-gray-900 text-sm">
                    <span className={`mt-1 ${channelColor.accent}`}>•</span>
                    <span className="flex-1">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Posts Sequence Section */}
      <div className="space-y-4 pt-4 border-t border-gray-300">
        <h4 className="text-lg font-semibold text-gray-900 uppercase tracking-wide">
          Séquence de posts ({detailedPlan.posts.length})
        </h4>

        <div className="space-y-6">
          {detailedPlan.posts.map((post, idx) => {
            return (
              <div key={idx} className="bg-white/60 border border-gray-200 rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-gray-300">
                  <div>
                    <h5 className="text-base font-semibold text-gray-900">Post {idx + 1}</h5>
                    <p className="text-xs text-gray-600 mt-1">{formatDate(post.scheduledDate)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-600 uppercase tracking-wide block">Temps restant</span>
                    <PostCountdown scheduledDate={post.scheduledDate} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 uppercase tracking-wide">Description de l'image</span>
                      {!generatedImages[idx] && (
                        <button
                          onClick={() => handleGenerateImage(idx, post.imageDescription)}
                          disabled={loadingImages[idx]}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                            loadingImages[idx]
                              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          }`}
                        >
                          {loadingImages[idx] ? "Génération..." : "Générer"}
                        </button>
                      )}
                    </div>
                    {imageErrors[idx] && (
                      <div className="p-3 bg-red-100 border border-red-400 rounded-lg text-red-800 text-xs">
                        <p className="font-semibold">Erreur</p>
                        <p>{imageErrors[idx]}</p>
                      </div>
                    )}
                    {generatedImages[idx] ? (
                      <div className="space-y-2">
                        <div
                          onClick={() => handleDownloadImage(idx)}
                          className="relative cursor-pointer group"
                          title="Cliquer pour télécharger l'image"
                        >
                          <img
                            src={generatedImages[idx]}
                            alt={`Image générée pour le post ${idx + 1}`}
                            className="w-full rounded-lg border border-gray-300 hover:border-blue-500 transition-colors"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600/90 text-white px-4 py-2 rounded-lg text-xs font-medium">
                              Télécharger l'image
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCopy(post.imageDescription, `image-desc-${idx}`)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            copiedText === `image-desc-${idx}`
                              ? "bg-green-500/20 text-green-700"
                              : "bg-gray-300 hover:bg-gray-400 text-gray-700"
                          }`}
                        >
                          {copiedText === `image-desc-${idx}` ? "✓ Description copiée" : "📋 Copier la description"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <p className="text-gray-900 text-xs leading-relaxed flex-1">{post.imageDescription}</p>
                        <button
                          onClick={() => handleCopy(post.imageDescription, `image-desc-${idx}`)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ${
                            copiedText === `image-desc-${idx}`
                              ? "bg-green-500/20 text-green-700"
                              : "bg-gray-300 hover:bg-gray-400 text-gray-700"
                          }`}
                        >
                          {copiedText === `image-desc-${idx}` ? "✓" : "📋"}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs text-gray-600 uppercase tracking-wide">Description du post</span>
                    <div className="flex items-start gap-2">
                      <p className="text-gray-900 text-xs leading-relaxed flex-1">{post.postDescription}</p>
                      <button
                        onClick={() => handleCopy(post.postDescription, `post-desc-${idx}`)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ${
                          copiedText === `post-desc-${idx}`
                            ? "bg-green-500/20 text-green-700"
                            : "bg-gray-300 hover:bg-gray-400 text-gray-700"
                        }`}
                      >
                        {copiedText === `post-desc-${idx}` ? "✓" : "📋"}
                      </button>
                    </div>
                  </div>

                  {post.hashtags && post.hashtags.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs text-gray-600 uppercase tracking-wide">Hashtags</span>
                      <div className="flex flex-wrap gap-2">
                        {post.hashtags.map((tag, tagIdx) => (
                          <span
                            key={tagIdx}
                            className="px-2 py-1 bg-gray-300 rounded text-xs text-gray-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bouton Exécuter pour X */}
                  {channelPlan.channel === "X" && (
                    <div className="space-y-2 pt-2 border-t border-gray-300">
                      {executeErrors[idx] && (
                        <div className="p-3 bg-red-100 border border-red-400 rounded-lg text-red-800 text-xs">
                          <p className="font-semibold">Erreur lors de la publication</p>
                          <p>{executeErrors[idx]}</p>
                        </div>
                      )}
                      {executedPosts[idx] && (
                        <div className="p-3 bg-green-100 border border-green-400 rounded-lg text-green-800 text-xs">
                          <p className="font-semibold">✓ Post publié avec succès sur X !</p>
                        </div>
                      )}
                      <button
                        onClick={() => handleExecutePost(idx, post)}
                        disabled={executingPosts[idx] || executedPosts[idx]}
                        className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                          executedPosts[idx]
                            ? "bg-green-600 text-white cursor-not-allowed"
                            : executingPosts[idx]
                            ? "bg-gray-400 text-white cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        }`}
                      >
                        {executingPosts[idx]
                          ? "Publication en cours..."
                          : executedPosts[idx]
                          ? "✓ Publié"
                          : "Exécuter"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
