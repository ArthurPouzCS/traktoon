"use client";

import { useState } from "react";
import type { DetailedPlan, DetailedPost } from "@/types/detailed-plan";
import type { ChannelPlan } from "@/types/plan";
import { copyToClipboard } from "@/lib/utils/detailed-plan";

export interface LandingPageDetailViewProps {
  detailedPlan: DetailedPlan;
  channelPlan: ChannelPlan;
  planId?: string | null;
  onFlipBack: () => void;
}

export const LandingPageDetailView = ({
  detailedPlan,
  channelPlan,
  planId,
  onFlipBack,
}: Readonly<LandingPageDetailViewProps>) => {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(
    detailedPlan.vercelDeploymentUrl ?? null,
  );

  const getNormalizedDeploymentUrl = (): string | null => {
    if (!deploymentUrl) return null;
    const hasProtocol = /^https?:\/\//i.test(deploymentUrl);
    return hasProtocol ? deploymentUrl : `https://${deploymentUrl}`;
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

  const handleGenerateSite = async () => {
    if (!planId) {
      setDeployError("Impossible de générer le site : planId manquant.");
      return;
    }

    setIsDeploying(true);
    setDeployError(null);

    try {
      const response = await fetch("/api/landing/vercel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId,
          channel: "LandingPage",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
          (errorData as { error?: string }).error ||
          "Erreur lors de la génération et du déploiement du site Vercel";
        throw new Error(message);
      }

      const data = (await response.json()) as { url: string };
      setDeploymentUrl(data.url);
    } catch (error) {
      console.error("Erreur lors de la génération du site Vercel:", error);
      setDeployError(error instanceof Error ? error.message : "Erreur inconnue");
    } finally {
      setIsDeploying(false);
    }
  };

  const sections: DetailedPost[] = detailedPlan.posts ?? [];

  return (
    <div className="relative bg-gray-100 border border-gray-300 rounded-xl p-8 space-y-8 h-full overflow-y-auto">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-500/10 text-orange-400 font-bold text-xl">
            LP
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">
              Plan détaillé - {channelPlan.channel}
            </h3>
            <p className="text-sm text-gray-600 mt-1">Landing page actionnable</p>
          </div>
        </div>
        <button
          onClick={onFlipBack}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-800 rounded-lg text-sm font-medium text-white transition-colors"
        >
          Retour
        </button>
      </div>

      {/* Bloc Vercel */}
      <div className="space-y-4 pt-4 border-t border-gray-300">
        <h4 className="text-lg font-semibold text-gray-900 uppercase tracking-wide">
          Site Vercel
        </h4>
        <div className="space-y-3 bg-white/60 rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-700">
            Génère un site vitrine complet (HTML + CSS) à partir de ce plan détaillé puis le déploie
            automatiquement sur Vercel.
          </p>
          {deployError && (
            <div className="p-3 bg-red-100 border border-red-400 rounded-lg text-red-800 text-xs">
              <p className="font-semibold">Erreur</p>
              <p>{deployError}</p>
            </div>
          )}
          {deploymentUrl && (
            <div className="p-3 bg-green-100 border border-green-400 rounded-lg text-green-800 text-xs space-y-1">
              <p className="font-semibold">Site généré</p>
              <a
                href={getNormalizedDeploymentUrl() ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="underline break-all"
              >
                {getNormalizedDeploymentUrl()}
              </a>
            </div>
          )}
          <button
            onClick={handleGenerateSite}
            disabled={isDeploying}
            className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
              isDeploying
                ? "bg-gray-400 text-white cursor-not-allowed"
                : "bg-orange-500 hover:bg-orange-600 text-white"
            }`}
          >
            {isDeploying ? "Génération du site en cours..." : "Générer le site avec Vercel"}
          </button>
        </div>
      </div>

      {/* Configuration du compte */}
      <div className="space-y-4 pt-4 border-t border-gray-300">
        <h4 className="text-lg font-semibold text-gray-900 uppercase tracking-wide">
          Configuration du compte / outil
        </h4>

        <div className="space-y-3 bg-white/60 rounded-lg p-4 border border-gray-200">
          <div className="space-y-2">
            <span className="text-xs text-gray-600 uppercase tracking-wide">
              URL d&apos;inscription / outil
            </span>
            <div className="flex items-center gap-2">
              <a
                href={detailedPlan.accountSetup.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 underline break-all flex-1"
              >
                {detailedPlan.accountSetup.registrationUrl}
              </a>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs text-gray-600 uppercase tracking-wide">
              Nom suggéré pour le compte / projet
            </span>
            <div className="flex items-center gap-2">
              <span className="text-gray-900">{detailedPlan.accountSetup.accountName}</span>
              <button
                onClick={() =>
                  handleCopy(detailedPlan.accountSetup.accountName, "account-name-landing")
                }
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  copiedText === "account-name-landing"
                    ? "bg-green-500/20 text-green-700"
                    : "bg-gray-300 hover:bg-gray-400 text-gray-700"
                }`}
              >
                {copiedText === "account-name-landing" ? "✓ Copié" : "Copier"}
              </button>
            </div>
          </div>

          {detailedPlan.accountSetup.steps && detailedPlan.accountSetup.steps.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-gray-600 uppercase tracking-wide">
                Étapes de configuration
              </span>
              <ul className="space-y-2">
                {detailedPlan.accountSetup.steps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-gray-900 text-sm">
                    <span className="mt-1 text-orange-400">•</span>
                    <span className="flex-1">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Sections de la landing */}
      {sections.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-gray-300">
          <h4 className="text-lg font-semibold text-gray-900 uppercase tracking-wide">
            Sections de la landing ({sections.length})
          </h4>

          <div className="space-y-6">
            {sections.map((section, idx) => (
              <div
                key={idx}
                className="bg-white/60 border border-gray-200 rounded-lg p-6 space-y-4"
              >
                <div className="flex items-center justify-between pb-4 border-b border-gray-300">
                  <div>
                    <h5 className="text-base font-semibold text-gray-900">
                      Section {idx + 1}
                    </h5>
                    <p className="text-xs text-gray-600 mt-1">
                      Ordre technique basé sur la date: {new Date(section.scheduledDate).toLocaleString("fr-FR")}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-xs text-gray-600 uppercase tracking-wide">
                      Description visuelle (image / ambiance)
                    </span>
                    <p className="text-gray-900 text-sm leading-relaxed">
                      {section.imageDescription}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs text-gray-600 uppercase tracking-wide">
                      Contenu texte de la section
                    </span>
                    <div className="flex items-start gap-2">
                      <p className="text-gray-900 text-sm leading-relaxed flex-1 whitespace-pre-line">
                        {section.postDescription}
                      </p>
                      <button
                        onClick={() =>
                          handleCopy(section.postDescription, `section-desc-${idx}`)
                        }
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ${
                          copiedText === `section-desc-${idx}`
                            ? "bg-green-500/20 text-green-700"
                            : "bg-gray-300 hover:bg-gray-400 text-gray-700"
                        }`}
                      >
                        {copiedText === `section-desc-${idx}` ? "✓" : "📋"}
                      </button>
                    </div>
                  </div>

                  {section.hashtags && section.hashtags.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs text-gray-600 uppercase tracking-wide">
                        Tags / mots-clés de la section
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {section.hashtags.map((tag, tagIdx) => (
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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

