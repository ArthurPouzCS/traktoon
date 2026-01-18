"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PlanDisplay } from "@/components/PlanDisplay";
import { createClient } from "@/lib/supabase/client";
import type { GoToMarketPlan } from "@/types/plan";
import type { DetailedPlan } from "@/types/detailed-plan";

interface GTMPlanRecord {
  id: string;
  prompt: string;
  answers: Record<string, string> | null;
  plan_data: GoToMarketPlan;
  detailed_plans: Record<string, DetailedPlan> | null;
  created_at: string;
  updated_at: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<GTMPlanRecord[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<GTMPlanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      loadPlans();
    };
    
    checkAuth();
  }, [router]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch("/api/plans");
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors du chargement de l'historique");
      }
      
      const data = await response.json();
      setPlans(data.plans || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (planId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce plan ?")) {
      return;
    }
    
    try {
      setDeletingId(planId);
      const response = await fetch(`/api/plans?id=${planId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la suppression");
      }
      
      // Retirer le plan de la liste
      setPlans((prev) => prev.filter((p) => p.id !== planId));
      
      // Si le plan supprimé était sélectionné, désélectionner
      if (selectedPlan?.id === planId) {
        setSelectedPlan(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la suppression");
    } finally {
      setDeletingId(null);
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

  // Vue détaillée d'un plan
  if (selectedPlan) {
    return (
      <div className="min-h-screen bg-black text-white relative flex flex-col">
        <header className="w-full px-6 py-6 flex items-center justify-between border-b border-zinc-800">
          <div className="text-xl ml-2 font-semibold text-white">Traktoon</div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedPlan(null)}
              className="px-4 py-2 bg-zinc-900 rounded-lg text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
            >
              Retour à l'historique
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-zinc-900 rounded-lg text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
            >
              Se déconnecter
            </button>
          </div>
        </header>

        <main className="flex-1 w-full px-6 py-12">
          <div className="mb-6 text-center">
            <p className="text-zinc-400 text-sm mb-2">Créé le {formatDate(selectedPlan.created_at)}</p>
            <p className="text-zinc-300 text-base italic">"{selectedPlan.prompt}"</p>
          </div>
          <PlanDisplay
            plan={selectedPlan.plan_data}
            planId={selectedPlan.id}
            detailedPlans={selectedPlan.detailed_plans}
          />
        </main>
      </div>
    );
  }

  // Liste des plans
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

      <main className="flex-1 w-full px-6 py-12">
        <div className="w-full max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Historique des plans</h1>
            <p className="text-lg text-zinc-400">
              {plans.length} plan{plans.length > 1 ? "s" : ""} sauvegardé{plans.length > 1 ? "s" : ""}
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
              <p className="text-zinc-400">Chargement de l'historique...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl text-zinc-400 mb-4">Aucun plan sauvegardé</p>
              <a
                href="/"
                className="inline-block px-6 py-3 bg-zinc-900 rounded-lg text-white font-medium hover:bg-zinc-800 transition-colors"
              >
                Créer votre premier plan
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 cursor-pointer hover:border-zinc-700 transition-colors space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium line-clamp-2 mb-2">{plan.prompt}</p>
                      <p className="text-zinc-400 text-sm">{formatDate(plan.created_at)}</p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(plan.id, e)}
                      disabled={deletingId === plan.id}
                      className="flex-shrink-0 px-3 py-1.5 bg-red-900 hover:bg-red-800 disabled:bg-zinc-800 disabled:cursor-not-allowed rounded text-sm font-medium text-white transition-colors"
                    >
                      {deletingId === plan.id ? "..." : "Supprimer"}
                    </button>
                  </div>
                  <div className="pt-2 border-t border-zinc-800">
                    <p className="text-zinc-500 text-xs">
                      {plan.plan_data.channels.length} canal{plan.plan_data.channels.length > 1 ? "aux" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
