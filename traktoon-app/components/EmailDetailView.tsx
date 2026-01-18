"use client";

import { useState } from "react";
import type { DetailedPlan } from "@/types/detailed-plan";
import { copyToClipboard, parseEmails } from "@/lib/utils/detailed-plan";
import type { ChannelPlan } from "@/types/plan";

interface EmailCountdownProps {
  scheduledDate: string;
}

const EmailCountdown = ({ scheduledDate }: Readonly<EmailCountdownProps>) => {
  const now = new Date();
  const target = new Date(scheduledDate);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) {
    return <span className="text-gray-900 font-semibold">Terminé</span>;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days} jour${days > 1 ? "s" : ""}`);
  }
  if (hours > 0) {
    parts.push(`${hours} heure${hours > 1 ? "s" : ""}`);
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
  }

  return <span className="text-gray-900 font-semibold">{parts.join(", ")}</span>;
};

export interface EmailDetailViewProps {
  detailedPlan: DetailedPlan;
  channelPlan: ChannelPlan;
  onFlipBack: () => void;
}

const channelColors: Record<string, { accent: string; light: string }> = {
  Email: { accent: "text-purple-400", light: "bg-purple-500/10" },
};

export const EmailDetailView = ({ detailedPlan, channelPlan, onFlipBack }: Readonly<EmailDetailViewProps>) => {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [targetDescription, setTargetDescription] = useState<string>(channelPlan.description || "");
  const [targetEmails, setTargetEmails] = useState<string>("");
  const [executingEmails, setExecutingEmails] = useState<Record<number, boolean>>({});
  const [executedEmails, setExecutedEmails] = useState<Record<number, boolean>>({});
  const [executeErrors, setExecuteErrors] = useState<Record<number, string>>({});
  const [executeResults, setExecuteResults] = useState<Record<number, { sent: number; failed: number }>>({});
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

  const handleExecuteEmail = async (emailIndex: number) => {
    if (!detailedPlan.emails || !detailedPlan.emails[emailIndex]) {
      return;
    }

    const email = detailedPlan.emails[emailIndex];
    const parsedEmails = parseEmails(targetEmails);

    if (parsedEmails.length === 0) {
      setExecuteErrors((prev) => ({
        ...prev,
        [emailIndex]: "Aucun email valide dans le champ cible",
      }));
      return;
    }

    setExecutingEmails((prev) => ({ ...prev, [emailIndex]: true }));
    setExecuteErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[emailIndex];
      return newErrors;
    });
    setExecuteResults((prev) => {
      const newResults = { ...prev };
      delete newResults[emailIndex];
      return newResults;
    });

    try {
      const response = await fetch("/api/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: parsedEmails,
          subject: email.subject,
          html: email.bodyHtml,
          text: email.bodyText,
        }),
      });

      // Vérifier le Content-Type avant de parser
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Réponse invalide du serveur (${response.status}). Vérifiez que l'API /api/email est correctement configurée.`);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erreur ${response.status} lors de l'envoi de l'email`);
      }

      const data = await response.json();

      if (data.success) {
        setExecutedEmails((prev) => ({ ...prev, [emailIndex]: true }));
        if (data.sent !== undefined) {
          setExecuteResults((prev) => ({
            ...prev,
            [emailIndex]: {
              sent: data.sent || parsedEmails.length,
              failed: data.failed || 0,
            },
          }));
        }
      } else {
        throw new Error(data.error || "Erreur lors de l'envoi de l'email");
      }
    } catch (error) {
      console.error("Erreur lors de l'exécution de l'email:", error);
      
      let errorMessage = "Erreur inconnue";
      if (error instanceof Error) {
        // Si c'est déjà une erreur de parsing JSON
        if (error.message.includes("JSON")) {
          errorMessage = "Erreur de communication avec le serveur. Vérifiez que l'API /api/email fonctionne correctement.";
        } else {
          errorMessage = error.message;
        }
      }
      
      setExecuteErrors((prev) => ({
        ...prev,
        [emailIndex]: errorMessage,
      }));
    } finally {
      setExecutingEmails((prev) => ({ ...prev, [emailIndex]: false }));
    }
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

      {/* Cible Section */}
      <div className="space-y-4 pt-4 border-t border-gray-300">
        <h4 className="text-lg font-semibold text-gray-900 uppercase tracking-wide">Cible</h4>
        
        <div className="space-y-3 bg-white/60 rounded-lg p-4 border border-gray-200">
          <div className="space-y-2">
            <label className="text-xs text-gray-600 uppercase tracking-wide">Description de la cible</label>
            <input
              type="text"
              value={targetDescription}
              onChange={(e) => setTargetDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Description de la cible..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-gray-600 uppercase tracking-wide">Emails à contacter</label>
            <textarea
              value={targetEmails}
              onChange={(e) => setTargetEmails(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[120px] font-mono"
              placeholder="email1@example.com, email2@example.com&#10;email3@example.com; email4@example.com"
            />
            <p className="text-xs text-gray-500">
              Séparez les emails par des virgules, des point-virgules ou des retours à la ligne
            </p>
          </div>
        </div>
      </div>

      {/* Email Sequence Section */}
      {detailedPlan.emails && detailedPlan.emails.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-gray-300">
          <h4 className="text-lg font-semibold text-gray-900 uppercase tracking-wide">
            Séquence de mails ({detailedPlan.emails.length})
          </h4>

          <div className="space-y-6">
            {detailedPlan.emails.map((email, idx) => {
              return (
                <div key={idx} className="bg-white/60 border border-gray-200 rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-300">
                    <div>
                      <h5 className="text-base font-semibold text-gray-900">Email {idx + 1}</h5>
                      <p className="text-xs text-gray-600 mt-1">{formatDate(email.scheduledDate)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-600 uppercase tracking-wide block">Temps restant</span>
                      <EmailCountdown scheduledDate={email.scheduledDate} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <span className="text-xs text-gray-600 uppercase tracking-wide">Sujet</span>
                      <div className="flex items-start gap-2">
                        <p className="text-gray-900 text-sm leading-relaxed flex-1">{email.subject}</p>
                        <button
                          onClick={() => handleCopy(email.subject, `email-subject-${idx}`)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ${
                            copiedText === `email-subject-${idx}`
                              ? "bg-green-500/20 text-green-700"
                              : "bg-gray-300 hover:bg-gray-400 text-gray-700"
                          }`}
                        >
                          {copiedText === `email-subject-${idx}` ? "✓" : "📋"}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs text-gray-600 uppercase tracking-wide">Corps HTML</span>
                      <div className="flex items-start gap-2">
                        <div
                          className="text-gray-900 text-sm leading-relaxed flex-1 p-3 bg-gray-50 rounded border border-gray-200 overflow-auto max-h-[200px]"
                          dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
                        />
                        <button
                          onClick={() => handleCopy(email.bodyHtml, `email-html-${idx}`)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ${
                            copiedText === `email-html-${idx}`
                              ? "bg-green-500/20 text-green-700"
                              : "bg-gray-300 hover:bg-gray-400 text-gray-700"
                          }`}
                        >
                          {copiedText === `email-html-${idx}` ? "✓" : "📋"}
                        </button>
                      </div>
                    </div>

                    {email.bodyText && (
                      <div className="space-y-2">
                        <span className="text-xs text-gray-600 uppercase tracking-wide">Corps Texte</span>
                        <div className="flex items-start gap-2">
                          <p className="text-gray-900 text-sm leading-relaxed flex-1 whitespace-pre-wrap">
                            {email.bodyText}
                          </p>
                          <button
                            onClick={() => handleCopy(email.bodyText || "", `email-text-${idx}`)}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ${
                              copiedText === `email-text-${idx}`
                                ? "bg-green-500/20 text-green-700"
                                : "bg-gray-300 hover:bg-gray-400 text-gray-700"
                            }`}
                          >
                            {copiedText === `email-text-${idx}` ? "✓" : "📋"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Bouton Exécuter */}
                    <div className="space-y-2 pt-2 border-t border-gray-300">
                      {executeErrors[idx] && (
                        <div className="p-3 bg-red-100 border border-red-400 rounded-lg text-red-800 text-xs">
                          <p className="font-semibold">Erreur lors de l'envoi</p>
                          <p>{executeErrors[idx]}</p>
                        </div>
                      )}
                      {executedEmails[idx] && (
                        <div className="p-3 bg-green-100 border border-green-400 rounded-lg text-green-800 text-xs">
                          <p className="font-semibold">✓ Email envoyé avec succès !</p>
                          {executeResults[idx] && (
                            <p>
                              {executeResults[idx].sent} email(s) envoyé(s), {executeResults[idx].failed} échec(s)
                            </p>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => handleExecuteEmail(idx)}
                        disabled={executingEmails[idx] || executedEmails[idx]}
                        className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                          executedEmails[idx]
                            ? "bg-green-600 text-white cursor-not-allowed"
                            : executingEmails[idx]
                            ? "bg-gray-400 text-white cursor-not-allowed"
                            : "bg-purple-600 hover:bg-purple-700 text-white"
                        }`}
                      >
                        {executingEmails[idx]
                          ? "Envoi en cours..."
                          : executedEmails[idx]
                          ? "✓ Envoyé"
                          : "Exécuter"}
                      </button>
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
