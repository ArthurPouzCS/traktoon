import { NextRequest, NextResponse } from "next/server";
import { generateQuestions, generatePlan } from "@/lib/gemini/client";
import { createClient } from "@/lib/supabase/server";
import type { QuestionConfig } from "@/types/conversation";
import type { GoToMarketPlan } from "@/types/plan";

interface QuestionsRequest {
  type: "questions";
  prompt: string;
}

interface PlanRequest {
  type: "plan";
  prompt: string;
  answers: Record<string, string>;
}

type ApiRequest = QuestionsRequest | PlanRequest;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: ApiRequest = await request.json();

    if (!body.type || !body.prompt) {
      return NextResponse.json(
        { error: "Type et prompt sont requis" },
        { status: 400 },
      );
    }

    if (body.type === "questions") {
      const questions: QuestionConfig[] = await generateQuestions(body.prompt);
      return NextResponse.json({ questions });
    }

    if (body.type === "plan") {
      if (!body.answers || Object.keys(body.answers).length === 0) {
        return NextResponse.json(
          { error: "Les réponses sont requises pour générer un plan" },
          { status: 400 },
        );
      }

      const plan: GoToMarketPlan = await generatePlan(body.prompt, body.answers);
      
      // Sauvegarder le plan dans Supabase
      let planId: string | null = null;
      try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          console.error("Erreur d'authentification lors de la sauvegarde du plan:", authError);
          // On continue quand même à retourner le plan même si la sauvegarde échoue
        } else {
          const { data: insertedData, error: insertError } = await supabase
            .from("gtm_plans")
            .insert({
              user_id: user.id,
              prompt: body.prompt,
              answers: body.answers,
              plan_data: plan,
            })
            .select("id")
            .single();

          if (insertError) {
            console.error("Erreur lors de la sauvegarde du plan:", insertError);
            // On continue quand même à retourner le plan même si la sauvegarde échoue
          } else if (insertedData) {
            planId = insertedData.id;
          }
        }
      } catch (saveError) {
        console.error("Erreur lors de la sauvegarde du plan:", saveError);
        // On continue quand même à retourner le plan même si la sauvegarde échoue
      }
      
      return NextResponse.json({ plan, planId });
    }

    return NextResponse.json(
      { error: "Type de requête invalide" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Erreur API Gemini:", error);
    
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
