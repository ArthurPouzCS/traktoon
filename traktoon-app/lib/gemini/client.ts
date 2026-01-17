import { GoogleGenerativeAI } from "@google/generative-ai";
import { goToMarketPlanSchema } from "./schema";
import type { GoToMarketPlan } from "@/types/plan";
import type { QuestionConfig } from "@/types/conversation";
import { generateQuestions as generateQuestionsConfig } from "./questions-config";

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
  return generateQuestionsConfig(prompt);
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
