"use client";

import { useState, useEffect } from "react";
import type { ChannelPlan, PlanStatus } from "@/types/plan";
import type { DetailedPlan } from "@/types/detailed-plan";
import { PlanDetailView } from "./PlanDetailView";

export interface PlanCardProps {
  channelPlan: ChannelPlan;
  index: number;
  planId?: string | null;
  savedDetailedPlan?: DetailedPlan | null;
}

const statusColors: Record<PlanStatus, { bg: string; text: string; border: string }> = {
  "à faire": {
    bg: "bg-zinc-900/50",
    text: "text-zinc-400",
    border: "border-zinc-700",
  },
  "en cours": {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
  },
  "terminé": {
    bg: "bg-green-500/10",
    text: "text-green-400",
    border: "border-green-500/30",
  },
};

const channelColors: Record<string, { accent: string; light: string }> = {
  X: { accent: "text-blue-400", light: "bg-blue-500/10" },
  Instagram: { accent: "text-pink-400", light: "bg-pink-500/10" },
  TikTok: { accent: "text-cyan-400", light: "bg-cyan-500/10" },
  Email: { accent: "text-purple-400", light: "bg-purple-500/10" },
  LinkedIn: { accent: "text-indigo-400", light: "bg-indigo-500/10" },
  GoogleAds: { accent: "text-red-400", light: "bg-red-500/10" },
  LandingPage: { accent: "text-orange-400", light: "bg-orange-500/10" },
};

const formatContentAsBullets = (content: string): string[] => {
  // Détecte les listes à puces et les retours à la ligne
  const lines = content.split(/\n+/).filter((line) => line.trim());
  return lines.map((line) => line.replace(/^[•\-\*]\s*/, "").trim());
};

const isSocialMediaChannel = (channel: string): boolean => {
  return channel === "X" || channel === "Instagram" || channel === "TikTok" || channel === "LinkedIn";
};

export const PlanCard = ({ channelPlan, index, planId, savedDetailedPlan }: Readonly<PlanCardProps>) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [detailedPlan, setDetailedPlan] = useState<DetailedPlan | null>(savedDetailedPlan || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusColor = statusColors["à faire"];
  const channelColor = channelColors[channelPlan.channel] || {
    accent: "text-white",
    light: "bg-zinc-800/50",
  };

  const contentBullets = formatContentAsBullets(channelPlan.content);
  const isSocialMedia = isSocialMediaChannel(channelPlan.channel);

  // Mettre à jour le plan détaillé quand savedDetailedPlan change
  useEffect(() => {
    if (savedDetailedPlan) {
      setDetailedPlan(savedDetailedPlan);
    }
  }, [savedDetailedPlan]);

  const handlePrecise = async () => {
    // Si un plan détaillé sauvegardé existe, l'utiliser directement
    if (savedDetailedPlan) {
      setDetailedPlan(savedDetailedPlan);
      setIsFlipped(true);
      return;
    }

    // Si le plan détaillé existe déjà dans le state (généré dans cette session), on fait juste le flip
    if (detailedPlan) {
      setIsFlipped(true);
      return;
    }

    // Sinon, on génère le plan détaillé via le LLM
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/gemini/precise", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelPlan,
          planId: planId || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la génération du plan détaillé");
      }

      const data = await response.json();
      setDetailedPlan(data.detailedPlan);
      setIsFlipped(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
      console.error("Erreur lors de la génération du plan détaillé:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlipBack = () => {
    setIsFlipped(false);
  };

  return (
    <div className="relative perspective-1000" style={{ minHeight: "600px" }}>
      {/* Container for 3D flip */}
      <div
        className={`relative w-full h-full transition-transform duration-700 transform-style-preserve-3d ${
          isFlipped ? "rotate-y-180" : ""
        }`}
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front face - PlanCard */}
        <div
          className={`absolute w-full h-full backface-hidden ${
            isFlipped ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(0deg)",
          }}
        >
          <div
            className={`relative bg-zinc-900/80 border ${statusColor.border} rounded-xl p-8 space-y-6 hover:border-zinc-600 transition-all duration-300 h-full`}
          >
            {/* Header with Number and Channel */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-full ${channelColor.light} ${channelColor.accent} font-bold text-xl`}
                >
                  {index}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">{channelPlan.channel}</h3>
                  {channelPlan.description && (
                    <p className="text-sm text-zinc-400 mt-1">{channelPlan.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isSocialMedia && (
                  <button
                    onClick={handlePrecise}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded text-xs font-medium text-white transition-colors"
                  >
                    {isLoading ? "Génération..." : "Préciser"}
                  </button>
                )}
                <span
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}
                >
                  À faire
                </span>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-100 text-sm">
                <p className="font-semibold">Erreur</p>
                <p>{error}</p>
              </div>
            )}

            {/* Sequence */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Séquence</h4>
              <p className="text-white text-base leading-relaxed">{channelPlan.sequence}</p>
            </div>

            {/* Content as Bullets */}
            {contentBullets.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Contenu</h4>
                <ul className="space-y-2">
                  {contentBullets.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className={`mt-1.5 ${channelColor.accent}`}>•</span>
                      <span className="text-white text-base leading-relaxed flex-1">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Target */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Cible</h4>
              <p className="text-white text-base leading-relaxed">{channelPlan.target}</p>
            </div>

            {/* Steps */}
            {channelPlan.steps && channelPlan.steps.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
                  Étapes ({channelPlan.steps.length})
                </h4>
                <div className="space-y-3">
                  {channelPlan.steps.map((step, stepIndex) => {
                    const stepStatusColor = statusColors[step.status];
                    return (
                      <div
                        key={stepIndex}
                        className={`bg-zinc-800/50 border ${stepStatusColor.border} rounded-lg p-4 space-y-3`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex items-center justify-center w-8 h-8 rounded-full ${channelColor.light} ${channelColor.accent} font-semibold text-sm`}
                            >
                              {stepIndex + 1}
                            </div>
                            <span className="text-sm font-semibold text-white">
                              Étape {stepIndex + 1}
                            </span>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded text-xs font-semibold ${stepStatusColor.bg} ${stepStatusColor.text}`}
                          >
                            {step.status}
                          </span>
                        </div>
                        <div className="space-y-2 pl-11">
                          <div>
                            <span className="text-xs text-zinc-400 uppercase tracking-wide">Séquence:</span>
                            <p className="text-sm text-white mt-1">{step.sequence}</p>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-400 uppercase tracking-wide">Contenu:</span>
                            <p className="text-sm text-white mt-1 leading-relaxed">{step.content}</p>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-400 uppercase tracking-wide">Cible:</span>
                            <p className="text-sm text-white mt-1">{step.target}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back face - PlanDetailView */}
        <div
          className={`absolute w-full h-full backface-hidden ${
            isFlipped ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {detailedPlan && (
            <PlanDetailView
              detailedPlan={detailedPlan}
              channelPlan={channelPlan}
              onFlipBack={handleFlipBack}
            />
          )}
        </div>
      </div>
    </div>
  );
};
