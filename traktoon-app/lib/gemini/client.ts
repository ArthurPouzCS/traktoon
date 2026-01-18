import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";
import { goToMarketPlanSchema, questionsSchema, detailedPlanSchema } from "./schema";
import type { GoToMarketPlan, ChannelPlan } from "@/types/plan";
import type { QuestionConfig } from "@/types/conversation";
import type { DetailedPlan } from "@/types/detailed-plan";

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
Prompt initial, l'idée de l'utilisateur et à qui il veut le vendre : ${prompt}

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

Pense à préciser la cible, comprendre le budget de l'utilisateur, les objectifs, le contexte, etc.
Pose des questions relative au projet, pas de question générique.

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
Tu es expert en Go to market, tu ne génères que des plans très pertinents et efficaces. Texte court et percutant.
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

export async function generateDetailedPlan(channelPlan: ChannelPlan): Promise<DetailedPlan> {
  let lastError: Error | null = null;

  for (const modelName of MODEL_NAMES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });

      const now = new Date();
      const currentDateISO = now.toISOString();
      const currentDateReadable = now.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const fullContext = `
Plan du channel actuel:
- Channel: ${channelPlan.channel}
- Séquence: ${channelPlan.sequence}
- Contenu: ${channelPlan.content}
- Cible: ${channelPlan.target}
${channelPlan.description ? `- Description: ${channelPlan.description}` : ""}
- Étapes: ${JSON.stringify(channelPlan.steps, null, 2)}

Date actuelle: ${currentDateReadable} (ISO: ${currentDateISO})

Tu dois générer un plan détaillé "copié-collé" pour faciliter l'implémentation manuelle sur le réseau social ${channelPlan.channel}.
Ce plan doit être actionnable et prêt à l'emploi, avec toutes les informations nécessaires pour:
1. Créer/compléter le compte sur la plateforme (URL exacte, nom de compte suggéré, étapes si besoin)
2. Publier une séquence de posts avec:
   - Dates précises de publication FUTURES (format ISO 8601) - les dates doivent être POSTÉRIEURES à la date actuelle
   - Descriptions détaillées des images à créer/mettre (pour future génération IA)
   - Descriptions complètes des posts à publier (prêtes à copier-coller)
   - Hashtags pertinents (optionnels)

Le plan doit être pratique et permettre à l'utilisateur d'implémenter facilement le plan go-to-market sans utiliser d'API complexe.

Réponds UNIQUEMENT avec un JSON valide respectant exactement ce schéma:
{
  "accountSetup": {
    "registrationUrl": "https://url-exacte-pour-creer-le-compte",
    "accountName": "nom-suggere-pour-le-compte",
    "steps": ["Étape 1 optionnelle", "Étape 2 optionnelle"]
  },
  "posts": [
    {
      "scheduledDate": "2026-01-20T10:00:00Z",
      "imageDescription": "Description détaillée de l'image à créer: style, contenu, couleurs, message visuel",
      "postDescription": "Texte complet du post prêt à copier-coller",
      "hashtags": ["#tag1", "#tag2"]
    }
  ]
}

IMPORTANT: 
- Les dates doivent être FUTURES et POSTÉRIEURES à la date actuelle (${currentDateReadable})
- Les dates doivent être réalistes et espacées selon une séquence logique (par exemple: premier post dans 2-3 jours, puis un post par semaine)
- Utilise des dates en 2026 ou au-delà selon la date actuelle fournie
- Les descriptions d'images doivent être détaillées pour permettre une génération IA future
- Les descriptions de posts doivent être complètes et prêtes à utiliser
- Réponds UNIQUEMENT avec le JSON, sans texte avant ou après, sans markdown, sans code blocks.
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
      const validated = detailedPlanSchema.parse(parsed);

      return validated;
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
        throw new Error(`Erreur lors de la génération du plan détaillé: ${error.message}`);
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

export async function generateImage(prompt: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt,
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("Aucune réponse du modèle de génération d'image");
    }

    const candidate = response.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      throw new Error("Format de réponse invalide du modèle de génération d'image");
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData && part.inlineData.data) {
        // Retourner l'image en base64
        return part.inlineData.data;
      }
    }

    throw new Error("Aucune image générée dans la réponse");
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Erreur lors de la génération d'image: ${error.message}`);
    }
    throw new Error("Erreur inconnue lors de la génération d'image");
  }
}

interface SiteAnalysisInput {
  url: string;
  pages?: Array<{
    url: string;
    content: unknown;
    design: unknown;
  }>;
  content?: unknown;
  design?: unknown;
}

interface SiteAnalysisOutput {
  backgroundDescription: string;
}

export async function generateSiteAnalysis(
  input: SiteAnalysisInput,
): Promise<SiteAnalysisOutput> {
  let lastError: Error | null = null;

  const { url, pages, content, design } = input;
  const payload =
    pages && pages.length > 0
      ? { pages: pages.slice(0, 3) }
      : { content, design };

  const serialized = JSON.stringify(payload);
  const trimmedPayload =
    serialized.length > 12000 ? `${serialized.slice(0, 12000)}...` : serialized;

  for (const modelName of MODEL_NAMES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });

      const prompt = `
You are a product/marketing analyst. Based on the crawl data below for ${url},
write a detailed, factual summary of the site's primary purpose, the type of
product/service, key features or sections, target audience, and the value delivered.
Use 3 to 5 full sentences in English. Do NOT mention design, colors, layout, or UI.
Respond ONLY with valid JSON matching this schema:
{
  "backgroundDescription": "detailed and precise text in English"
}

IMPORTANT: Respond ONLY with the JSON, no extra text, no markdown.

Crawl data (JSON):
${trimmedPayload}
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      let jsonText = text.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      const parsed = JSON.parse(jsonText) as SiteAnalysisOutput;
      if (!parsed || typeof parsed.backgroundDescription !== "string") {
        throw new Error("Réponse Gemini invalide: backgroundDescription manquant");
      }

      return parsed;
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (
          errorMessage.includes("not found") ||
          errorMessage.includes("not supported") ||
          errorMessage.includes("404")
        ) {
          lastError = error;
          continue;
        }
        throw new Error(`Erreur lors de l'analyse du site: ${error.message}`);
      }
      lastError = error instanceof Error ? error : new Error("Erreur inconnue");
      continue;
    }
  }

  throw new Error(
    `Aucun modèle disponible. Dernière erreur: ${lastError?.message || "Modèle non trouvé"}`,
  );
}
