"use client";

import type { ChannelPlan, PlanStatus } from "@/types/plan";

export interface PlanCardProps {
  channelPlan: ChannelPlan;
  index: number;
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

export const PlanCard = ({ channelPlan, index }: Readonly<PlanCardProps>) => {
  const statusColor = statusColors["à faire"];
  const channelColor = channelColors[channelPlan.channel] || {
    accent: "text-white",
    light: "bg-zinc-800/50",
  };

  const contentBullets = formatContentAsBullets(channelPlan.content);

  return (
    <div
      className={`relative bg-zinc-900/80 border ${statusColor.border} rounded-xl p-8 space-y-6 hover:border-zinc-600 transition-all duration-300`}
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
        <span
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}
        >
          À faire
        </span>
      </div>

      {/* Sequence */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
          Séquence
        </h4>
        <p className="text-white text-base leading-relaxed">{channelPlan.sequence}</p>
      </div>

      {/* Content as Bullets */}
      {contentBullets.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
            Contenu
          </h4>
          <ul className="space-y-2">
            {contentBullets.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className={`mt-1.5 ${channelColor.accent}`}>•</span>
                <span className="text-white text-base leading-relaxed flex-1">
                  {bullet}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Target */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
          Cible
        </h4>
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
                      <span className="text-xs text-zinc-400 uppercase tracking-wide">
                        Séquence:
                      </span>
                      <p className="text-sm text-white mt-1">{step.sequence}</p>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-400 uppercase tracking-wide">
                        Contenu:
                      </span>
                      <p className="text-sm text-white mt-1 leading-relaxed">{step.content}</p>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-400 uppercase tracking-wide">
                        Cible:
                      </span>
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
  );
};
