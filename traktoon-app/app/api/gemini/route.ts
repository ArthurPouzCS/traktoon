import { NextRequest, NextResponse } from "next/server";
import { generateQuestions, generatePlan } from "@/lib/gemini/client";
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
      return NextResponse.json({ plan });
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
