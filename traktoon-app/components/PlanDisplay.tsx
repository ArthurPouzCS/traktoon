"use client";

import { PlanCard } from "./PlanCard";
import type { GoToMarketPlan } from "@/types/plan";
import type { DetailedPlan } from "@/types/detailed-plan";

export interface PlanDisplayProps {
  plan: GoToMarketPlan;
  planId?: string | null;
  detailedPlans?: Record<string, DetailedPlan> | null;
}

export const PlanDisplay = ({ plan, planId, detailedPlans }: Readonly<PlanDisplayProps>) => {
  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-12">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white">
          Plan Go-to-Market
        </h1>
        <p className="text-lg text-zinc-400">
          {plan.channels.length} canal{plan.channels.length > 1 ? "aux" : ""} prêt{plan.channels.length > 1 ? "s" : ""} à lancer
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {plan.channels.map((channelPlan, index) => (
          <PlanCard
            key={index}
            channelPlan={channelPlan}
            index={index + 1}
            planId={planId}
            savedDetailedPlan={detailedPlans?.[channelPlan.channel] || null}
          />
        ))}
      </div>
    </div>
  );
};
