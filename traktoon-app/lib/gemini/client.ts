import { GoogleGenerativeAI } from "@google/generative-ai";
import { goToMarketPlanSchema, questionsSchema } from "./schema";
import type { GoToMarketPlan } from "@/types/plan";
import type { QuestionConfig } from "@/types/conversation";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY is not set in environment variables");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Liste des modèles à essayer dans l'ordre de préférence
const MODEL_NAMES = [
  "gemini-2.0-flash-exp",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
] as const;

export async function generateQuestions(prompt: string): Promise<QuestionConfig[]> {
  let lastError: Error | null = null;

  for (const modelName of MODEL_NAMES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });

      const fullContext = `
Prompt initial: ${prompt}

Génère 3 à 4 questions pertinentes pour mieux comprendre le projet et créer un plan go-to-market efficace.
Chaque question doit avoir 3 propositions courtes (2-4 mots chacune) qui peuvent servir de réponses rapides.

Réponds UNIQUEMENT avec un JSON valide respectant exactement ce schéma:
{
  "questions": [
    {
      "question": "Texte de la question",
      "proposition1": "Proposition courte 1",
      "proposition2": "Proposition courte 2",
      "proposition3": "Proposition courte 3"
    }
  ]
}

Les questions doivent être pertinentes pour comprendre:
- Le produit/service
- La cible
- Les objectifs
- Le contexte (budget, délais, etc.)

IMPORTANT: Réponds UNIQUEMENT avec le JSON, sans texte avant ou après, sans markdown, sans code blocks.
`;

      const result = await model.generateContent(fullContext);
      const response = await result.response;
      const text = response.text();

      let jsonText = text.trim();

      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      const parsed = JSON.parse(jsonText);
      const validated = questionsSchema.parse(parsed);

      // Transformer en QuestionConfig[]
      const questions: QuestionConfig[] = validated.questions.map((q, index) => ({
        id: `question-${index + 1}`,
        label: q.question,
        type: "text" as const,
        required: true,
        placeholder: "Votre réponse libre...",
        propositions: [q.proposition1, q.proposition2, q.proposition3],
      }));

      return questions;
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        // Si c'est une erreur de modèle non trouvé, essayer le suivant
        if (
          errorMessage.includes("not found") ||
          errorMessage.includes("not supported") ||
          errorMessage.includes("404")
        ) {
          lastError = error;
          continue;
        }
        // Sinon, c'est une autre erreur (parsing, validation, etc.), la propager
        throw new Error(`Erreur lors de la génération des questions: ${error.message}`);
      }
      lastError = error instanceof Error ? error : new Error("Erreur inconnue");
      continue;
    }
  }

  // Si tous les modèles ont échoué
  throw new Error(
    `Aucun modèle disponible. Dernière erreur: ${lastError?.message || "Modèle non trouvé"}`,
  );
}

export async function generatePlan(
  prompt: string,
  answers: Record<string, string>,
): Promise<GoToMarketPlan> {
  let lastError: Error | null = null;

  for (const modelName of MODEL_NAMES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });

      const fullContext = `
Prompt initial: ${prompt}

Réponses aux questions:
${Object.entries(answers)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join("\n")}

Génère un plan go-to-market avec les 3 meilleurs channels pour ce produit/service.
Pour chaque channel, fournis:
- Le nom du channel
- La séquence paramétrée (workflow détaillé)
- Le contenu (texte, légende, sujet mail, corps mail selon le channel)
- La description du contenu si c'est une image/vidéo
- La cible (mot-clé ou type de posté)
- Les étapes détaillées avec séquence, contenu, cible et statut (par défaut "à faire")

Réponds UNIQUEMENT avec un JSON valide respectant exactement ce schéma:
{
  "channels": [
    {
      "channel": "X" | "Instagram" | "TikTok" | "Email" | "LinkedIn" | "GoogleAds" | "LandingPage",
      "sequence": "string décrivant la séquence paramétrée",
      "content": "string avec le contenu texte",
      "target": "string avec la cible (mot-clé ou posté)",
      "description": "string optionnelle si contenu image/vidéo",
      "steps": [
        {
          "sequence": "string",
          "content": "string",
          "target": "string",
          "status": "à faire"
        }
      ]
    }
  ]
}

IMPORTANT: Réponds UNIQUEMENT avec le JSON, sans texte avant ou après, sans markdown, sans code blocks.
`;

      const result = await model.generateContent(fullContext);
      const response = await result.response;
      const text = response.text();

      let jsonText = text.trim();

      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      const parsed = JSON.parse(jsonText);
      
      const validated = goToMarketPlanSchema.parse(parsed);
      
      // Transformer null en undefined pour les champs optionnels après validation
      const transformed: GoToMarketPlan = {
        channels: validated.channels.map((channel) => ({
          ...channel,
          description: channel.description ?? undefined,
        })),
      };

      return transformed;
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        // Si c'est une erreur de modèle non trouvé, essayer le suivant
        if (
          errorMessage.includes("not found") ||
          errorMessage.includes("not supported") ||
          errorMessage.includes("404")
        ) {
          lastError = error;
          continue;
        }
        // Sinon, c'est une autre erreur (parsing, validation, etc.), la propager
        throw new Error(`Erreur lors de la génération du plan: ${error.message}`);
      }
      lastError = error instanceof Error ? error : new Error("Erreur inconnue");
      continue;
    }
  }

  // Si tous les modèles ont échoué
  throw new Error(
    `Aucun modèle disponible. Dernière erreur: ${lastError?.message || "Modèle non trouvé"}`,
  );
}
