"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { QuestionForm } from "@/components/QuestionForm";
import { ConversationHistory } from "@/components/ConversationHistory";
import { PlanDisplay } from "@/components/PlanDisplay";
import { createClient } from "@/lib/supabase/client";
import type { QuestionConfig } from "@/types/conversation";
import type { ConversationMessage } from "@/types/conversation";
import type { GoToMarketPlan } from "@/types/plan";

type AppState = "prompt" | "questions" | "loading" | "plan";

export default function Home() {
  const router = useRouter();
  const [state, setState] = useState<AppState>("prompt");
  const [prompt, setPrompt] = useState("");
  const [questions, setQuestions] = useState<QuestionConfig[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [plan, setPlan] = useState<GoToMarketPlan | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [detailedPlans, setDetailedPlans] = useState<Record<string, import("@/types/detailed-plan").DetailedPlan> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  useEffect(() => {
    // Vérifier si l'utilisateur est connecté et récupérer le prompt sauvegardé
    const checkAuthAndRestorePrompt = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      // Vérifier s'il y a un prompt sauvegardé dans localStorage
      const savedPrompt = localStorage.getItem("traktoon_pending_prompt");
      
      if (session && savedPrompt) {
        // L'utilisateur est connecté et il y a un prompt en attente
        // Continuer automatiquement avec le prompt sauvegardé
        localStorage.removeItem("traktoon_pending_prompt");
        setPendingPrompt(savedPrompt);
      }
      
      setIsCheckingAuth(false);
    };
    
    checkAuthAndRestorePrompt();
  }, [router]);

  const normalizeUrlOnlyInput = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed || /\s/.test(trimmed)) return null;
    
    // Vérifier qu'il y a au moins un point dans le hostname (domaine.com)
    // ou que ça ressemble vraiment à une URL avec un point ou un slash
    if (!trimmed.includes(".") && !trimmed.includes("/")) return null;
    
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const url = new URL(candidate);
      // Vérifier que le hostname contient au moins un point (domaine valide)
      // ou que c'est localhost/local
      if (!url.hostname || (!url.hostname.includes(".") && !url.hostname.match(/^(localhost|local|127\.0\.0\.1)$/i))) {
        return null;
      }
      // Vérifier que le hostname fait au moins 4 caractères pour éviter les faux positifs
      if (url.hostname.length < 4) return null;
      
      return url.toString();
    } catch {
      return null;
    }
  };

  // Détecter si le prompt actuel contient une URL
  const detectedUrl = useMemo(() => normalizeUrlOnlyInput(prompt), [prompt]);

  const handlePromptSubmit = useCallback(async (userPrompt: string) => {
    // Vérifier l'authentification avant de continuer
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      // Sauvegarder le prompt dans localStorage et rediriger vers login
      localStorage.setItem("traktoon_pending_prompt", userPrompt);
      router.push("/login");
      return;
    }

    setError(null);
    setState("loading");

    const normalizedUrl = normalizeUrlOnlyInput(userPrompt);
    let finalPrompt = userPrompt;

    try {
      if (normalizedUrl) {
        const analysisResponse = await fetch("/api/lightpanda/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: normalizedUrl,
          }),
        });

        if (!analysisResponse.ok) {
          const errorData = await analysisResponse.json();
          throw new Error(errorData.error || "Erreur lors de l'analyse du site");
        }

        const analysisData = await analysisResponse.json();
        if (!analysisData.prompt) {
          throw new Error("Analyse du site incomplète: prompt manquant");
        }
        finalPrompt = analysisData.prompt;
      }

      setPrompt(finalPrompt);

      const userMessage: ConversationMessage = {
        role: "user",
        content: finalPrompt,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "questions",
          prompt: finalPrompt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la génération des questions");
      }

      const data = await response.json();
      setQuestions(data.questions);
      setState("questions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
      setState("prompt");
    }
  }, [router]);

  // Traiter le prompt en attente après vérification de l'authentification
  useEffect(() => {
    if (!isCheckingAuth && pendingPrompt) {
      const processPrompt = async () => {
        const promptToProcess = pendingPrompt;
        setPendingPrompt(null);
        await handlePromptSubmit(promptToProcess);
      };
      processPrompt();
    }
  }, [isCheckingAuth, pendingPrompt, handlePromptSubmit]);

  const handleQuestionsSubmit = async (answers: Record<string, string>) => {
    setError(null);
    setState("loading");

    const answersText = Object.entries(answers)
      .map(([key, value]) => {
        const question = questions.find((q) => q.id === key);
        return `${question?.label || key}: ${value}`;
      })
      .join("\n");

    const userMessage: ConversationMessage = {
      role: "user",
      content: `Réponses aux questions:\n${answersText}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "plan",
          prompt,
          answers,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de : génération du plan");
      }

      const data = await response.json();
      setPlan(data.plan);
      setPlanId(data.planId || null);

      // Charger les plans détaillés si planId existe
      if (data.planId) {
        try {
          const plansResponse = await fetch(`/api/plans?id=${data.planId}`);
          if (plansResponse.ok) {
            const plansData = await plansResponse.json();
            if (plansData.plan?.detailed_plans) {
              setDetailedPlans(plansData.plan.detailed_plans);
            }
          }
        } catch (err) {
          console.error("Erreur lors du chargement des plans détaillés:", err);
          // On continue même si le chargement échoue
        }
      }

      const assistantMessage: ConversationMessage = {
        role: "assistant",
        content: "Plan go-to-market généré avec succès !",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      setState("plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
      setState("questions");
    }
  };

  const handleReset = () => {
    setState("prompt");
    setPrompt("");
    setQuestions([]);
    setMessages([]);
    setPlan(null);
    setPlanId(null);
    setDetailedPlans(null);
    setError(null);
  };

  const promptRows = Math.min(12, Math.max(3, Math.ceil(prompt.length / 90)));

  const handleInputSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (prompt.trim()) {
      handlePromptSubmit(prompt.trim());
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

  // Page dédiée pour le plan
  if (state === "plan" && plan) {
    return (
      <div className="min-h-screen bg-black text-white relative flex flex-col">
        {/* Header */}
        <header className="w-full px-6 py-6 flex items-center justify-between border-b border-zinc-800">
          <div className="text-xl ml-2 font-semibold text-white">Traktoon</div>
          <div className="flex items-center gap-3">
            <a
              href="/history"
              className="px-4 py-2 bg-zinc-900 rounded-lg text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
            >
              Historique
            </a>
            <a
              href="/analytics"
              className="px-4 py-2 bg-zinc-900 rounded-lg text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
            >
              Analytics
            </a>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-zinc-900 rounded-lg text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
            >
              Nouveau plan
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-zinc-900 rounded-lg text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
            >
              Se déconnecter
            </button>
          </div>
        </header>

        {/* Plan Display - Full Width */}
        <main className="flex-1 w-full px-6 py-12">
          <PlanDisplay plan={plan} planId={planId} detailedPlans={detailedPlans} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative flex flex-col">
      {/* Header */}
      <header className="w-[98%] px-6 py-6 flex items-center justify-between">
        <div className="text-xl ml-2 font-semibold text-white">Traktoon</div>
        <div className="flex items-center gap-3">
          <a
            href="/history"
            className="px-4 py-2 bg-zinc-900 rounded-lg text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            Historique
          </a>
          <a
            href="/analytics"
            className="px-4 py-2 bg-zinc-900 rounded-lg text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            Analytics
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center px-6 py-8">
        <div className="w-full max-w-2xl flex flex-col items-center gap-6">
          {/* Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-white">Built for founders who ship</span>
          </div>

          {/* Headline */}
          <div className="text-center space-y-1">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] text-white">
              Test your GTM.
            </h1>
            <h1 className="text-5xl md:text-6xl lg:text-6xl font-bold leading-[1.1] text-white">
              Learn fast. Scale what works.
            </h1>
          </div>

          {/* Description */}
          <p className="text-base md:text-lg text-zinc-400 text-center max-w-xl mt-2">
            Traktoon helps you launch on one channel, measure real results, and decide when to
            double down — or move on.
          </p>

          {/* Input Form */}
          {state === "prompt" && (
            <form onSubmit={handleInputSubmit} className="w-full space-y-3 mt-4">
              <div className="w-full space-y-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your product idea..."
                  className={`w-full h-14 px-4 bg-zinc-900 border rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:border-transparent text-base text-center transition-colors ${
                    detectedUrl
                      ? "border-blue-500 focus:ring-blue-500"
                      : "border-zinc-800 focus:ring-white"
                  }`}
                  required
                />
                {detectedUrl && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-950/30 border border-blue-800/50 rounded-lg">
                    <svg
                      className="w-5 h-5 text-blue-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-sm text-blue-300">
                      Nous allons inspecter ce site web pour analyser son contenu, son design et ses fonctionnalités.
                    </p>
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="mt-2 w-full flex items-center justify-center gap-2 px-2 py-1 bg-zinc-900 rounded-lg text-white font-medium hover:bg-zinc-800 transition-colors"
              >
                Get started
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </form>
          )}

          {/* Afficher le prompt soumis */}
          {prompt && state !== "prompt" && (
            <div className="w-full mt-8 pt-8 border-t border-zinc-800">
              <div className="w-full space-y-3">
                <label className="text-sm text-zinc-400">Votre idée de produit</label>
                <textarea
                  value={prompt}
                  readOnly
                  rows={promptRows}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-base text-center opacity-60 cursor-not-allowed resize-none"
                />
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="w-full mt-4 p-4 bg-red-900 border border-red-700 rounded-lg text-red-100">
              <p className="font-semibold">Erreur</p>
              <p>{error}</p>
            </div>
          )}

          {/* Loading State */}
          {state === "loading" && (
            <div className="flex flex-col items-center gap-4 mt-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              <p className="text-xl text-zinc-400">Génération en cours...</p>
            </div>
          )}

          {/* Questions Form */}
          {state === "questions" && (
            <div className="w-full mt-8 pt-8 border-t border-zinc-800">
              <QuestionForm questions={questions} onSubmit={handleQuestionsSubmit} />
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full pb-6 pt-4 text-center text-sm text-zinc-500">
        For solo founders and early-stage builders.
      </footer>
    </div>
  );
}
