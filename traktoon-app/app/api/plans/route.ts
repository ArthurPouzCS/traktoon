import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("id");

    // Si un ID est fourni, retourner uniquement ce plan
    if (planId) {
      const { data, error } = await supabase
        .from("gtm_plans")
        .select("*")
        .eq("id", planId)
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Erreur lors de la récupération du plan:", error);
        return NextResponse.json(
          { error: "Erreur lors de la récupération du plan" },
          { status: 500 },
        );
      }

      if (!data) {
        return NextResponse.json(
          { error: "Plan non trouvé" },
          { status: 404 },
        );
      }

      const plan: GTMPlanRecord = {
        id: data.id,
        prompt: data.prompt,
        answers: data.answers,
        plan_data: data.plan_data as GoToMarketPlan,
        detailed_plans: (data.detailed_plans as Record<string, DetailedPlan>) || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      return NextResponse.json({ plan });
    }

    // Sinon, retourner tous les plans
    const { data, error } = await supabase
      .from("gtm_plans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur lors de la récupération des plans:", error);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des plans" },
        { status: 500 },
      );
    }

    const plans: GTMPlanRecord[] = (data || []).map((plan) => ({
      id: plan.id,
      prompt: plan.prompt,
      answers: plan.answers,
      plan_data: plan.plan_data as GoToMarketPlan,
      detailed_plans: (plan.detailed_plans as Record<string, DetailedPlan>) || null,
      created_at: plan.created_at,
      updated_at: plan.updated_at,
    }));

    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Erreur API Plans:", error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("id");

    if (!planId) {
      return NextResponse.json(
        { error: "ID du plan requis" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("gtm_plans")
      .delete()
      .eq("id", planId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Erreur lors de la suppression du plan:", error);
      return NextResponse.json(
        { error: "Erreur lors de la suppression du plan" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur API Plans DELETE:", error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}
