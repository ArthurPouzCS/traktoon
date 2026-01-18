import { NextRequest, NextResponse } from "next/server";
import { generateDetailedPlan } from "@/lib/gemini/client";
import { createClient } from "@/lib/supabase/server";
import type { ChannelPlan } from "@/types/plan";
import type { DetailedPlan } from "@/types/detailed-plan";

interface PreciseRequest {
  channelPlan: ChannelPlan;
  planId?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: PreciseRequest = await request.json();

    if (!body.channelPlan) {
      return NextResponse.json(
        { error: "ChannelPlan est requis" },
        { status: 400 },
      );
    }

    // Si planId est fourni, vérifier d'abord si un plan détaillé existe déjà
    if (body.planId) {
      try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (!authError && user) {
          // Récupérer le plan existant avec les plans détaillés
          const { data: existingPlan, error: fetchError } = await supabase
            .from("gtm_plans")
            .select("detailed_plans")
            .eq("id", body.planId)
            .eq("user_id", user.id)
            .single();

          if (!fetchError && existingPlan && existingPlan.detailed_plans) {
            const detailedPlans = existingPlan.detailed_plans as Record<string, DetailedPlan>;
            const existingDetailedPlan = detailedPlans[body.channelPlan.channel];
            
            // Si un plan détaillé existe déjà pour ce channel, le retourner directement
            if (existingDetailedPlan) {
              return NextResponse.json({ detailedPlan: existingDetailedPlan });
            }
          }
        }
      } catch (checkError) {
        console.error("Erreur lors de la vérification du plan détaillé:", checkError);
        // On continue pour générer un nouveau plan si la vérification échoue
      }
    }

    // Aucun plan détaillé trouvé, générer avec le LLM
    const detailedPlan: DetailedPlan = await generateDetailedPlan(body.channelPlan);

    // Sauvegarder le plan détaillé dans Supabase si planId est fourni
    if (body.planId) {
      try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (!authError && user) {
          // Récupérer le plan existant
          const { data: existingPlan, error: fetchError } = await supabase
            .from("gtm_plans")
            .select("detailed_plans")
            .eq("id", body.planId)
            .eq("user_id", user.id)
            .single();

          if (!fetchError && existingPlan) {
            // Mettre à jour le champ detailed_plans avec le nouveau plan détaillé pour ce channel
            const detailedPlans = (existingPlan.detailed_plans as Record<string, DetailedPlan>) || {};
            detailedPlans[body.channelPlan.channel] = detailedPlan;

            const { error: updateError } = await supabase
              .from("gtm_plans")
              .update({
                detailed_plans: detailedPlans,
                updated_at: new Date().toISOString(),
              })
              .eq("id", body.planId)
              .eq("user_id", user.id);

            if (updateError) {
              console.error("Erreur lors de la sauvegarde du plan détaillé:", updateError);
              // On continue quand même à retourner le plan détaillé même si la sauvegarde échoue
            }
          }
        }
      } catch (saveError) {
        console.error("Erreur lors de la sauvegarde du plan détaillé:", saveError);
        // On continue quand même à retourner le plan détaillé même si la sauvegarde échoue
      }
    }

    return NextResponse.json({ detailedPlan });
  } catch (error) {
    console.error("Erreur API Gemini Precise:", error);

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
