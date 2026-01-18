"use client";

import { useState } from "react";
import { QuestionForm } from "@/components/QuestionForm";
import { ConversationHistory } from "@/components/ConversationHistory";
import { PlanDisplay } from "@/components/PlanDisplay";
import type { QuestionConfig } from "@/types/conversation";
import type { ConversationMessage } from "@/types/conversation";
import type { GoToMarketPlan } from "@/types/plan";

type AppState = "prompt" | "questions" | "loading" | "plan";

export default function Home() {
  const [state, setState] = useState<AppState>("prompt");
  const [prompt, setPrompt] = useState("");
  const [questions, setQuestions] = useState<QuestionConfig[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [plan, setPlan] = useState<GoToMarketPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePromptSubmit = async (userPrompt: string) => {
    setPrompt(userPrompt);
    setError(null);
    setState("loading");

    const userMessage: ConversationMessage = {
      role: "user",
      content: userPrompt,
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
          type: "questions",
          prompt: userPrompt,
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
  };

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
        throw new Error(errorData.error || "Erreur lors de la génération du plan");
      }

      const data = await response.json();
      setPlan(data.plan);

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
    setError(null);
  };

  const handleInputSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (prompt.trim()) {
      handlePromptSubmit(prompt.trim());
    }
  };

  // Page dédiée pour le plan
  if (state === "plan" && plan) {
    return (
      <div className="min-h-screen bg-black text-white relative flex flex-col">
        {/* Header */}
        <header className="w-full px-6 py-6 flex items-center justify-between border-b border-zinc-800">
          <div className="text-xl ml-2 font-semibold text-white">Traktoon</div>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-zinc-900 rounded-lg text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            Nouveau plan
          </button>
        </header>

        {/* Plan Display - Full Width */}
        <main className="flex-1 w-full px-6 py-12">
          <PlanDisplay plan={plan} />
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
            href="/connections"
            className="px-4 py-2 bg-zinc-900 rounded-lg text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            Connexions
          </a>
          <button className="px-4 py-2 bg-zinc-900 rounded-lg text-sm font-medium text-white hover:bg-zinc-800 transition-colors">
            Get started
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
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your product idea..."
                className="w-full h-14 px-4 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent text-base text-center"
                required
              />
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
                <input
                  type="text"
                  value={prompt}
                  disabled
                  className="w-full h-14 px-4 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-base text-center opacity-60 cursor-not-allowed"
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
