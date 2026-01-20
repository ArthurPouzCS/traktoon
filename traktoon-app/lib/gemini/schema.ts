import { z } from "zod";
import type { Channel, PlanStatus } from "@/types/plan";

const channelSchema = z.enum(["X", "Instagram", "TikTok", "Email", "LinkedIn", "GoogleAds", "LandingPage"]);

const planStatusSchema = z.enum(["à faire", "en cours", "terminé"]);

const planStepSchema = z.object({
  sequence: z.string().describe("La séquence paramétrée de l'étape"),
  content: z.string().describe("Le contenu texte (légende, sujet, corps mail, etc.)"),
  target: z.string().describe("La cible (mot-clé ou posté)"),
  status: planStatusSchema.default("à faire"),
});

const channelPlanSchema = z.object({
  channel: channelSchema,
  sequence: z.string().describe("La séquence paramétrée globale du channel"),
  content: z.string().describe("Le contenu principal (texte, légende, sujet, corps mail)"),
  target: z.string().describe("La cible (mot-clé ou posté)"),
  description: z.string().nullish().describe("Description du contenu si c'est une image"),
  steps: z.array(planStepSchema).default([]),
});

export const goToMarketPlanSchema = z.object({
  channels: z.array(channelPlanSchema).length(3).describe("Les 3 meilleurs channels pour le go-to-market"),
});

export type GoToMarketPlanInput = z.infer<typeof goToMarketPlanSchema>;

const questionItemSchema = z.object({
  question: z.string().describe("La question à poser"),
  proposition1: z.string().describe("Première proposition courte"),
  proposition2: z.string().describe("Deuxième proposition courte"),
  proposition3: z.string().describe("Troisième proposition courte"),
});

export const questionsSchema = z.object({
  questions: z.array(questionItemSchema).min(3).max(4).describe("Liste de 3 à 4 questions avec leurs propositions"),
});

export type QuestionsInput = z.infer<typeof questionsSchema>;

const accountSetupSchema = z.object({
  registrationUrl: z.string().url().describe("URL pour créer/inscrire le compte sur la plateforme"),
  accountName: z.string().describe("Nom suggéré pour le compte"),
  steps: z.array(z.string()).optional().describe("Étapes optionnelles pour créer le compte"),
});

const detailedPostSchema = z.object({
  scheduledDate: z.string().describe("Date et heure du post au format ISO 8601 (ex: 2024-01-15T10:00:00Z)"),
  imageDescription: z.string().describe("Description détaillée de l'image à créer/générer pour le post"),
  postDescription: z.string().describe("Texte/description à mettre dans le post (copiable)"),
  hashtags: z.array(z.string()).optional().describe("Hashtags optionnels à inclure dans le post"),
});

const detailedEmailSchema = z.object({
  scheduledDate: z.string().describe("Date et heure de l'email au format ISO 8601 (ex: 2024-01-15T10:00:00Z)"),
  subject: z.string().describe("Sujet de l'email"),
  bodyHtml: z.string().describe("Corps de l'email en HTML"),
  bodyText: z.string().optional().describe("Corps de l'email en texte brut (optionnel)"),
});

export const detailedPlanSchema = z.object({
  accountSetup: accountSetupSchema.describe("Informations pour créer le compte sur la plateforme"),
  posts: z
    .array(detailedPostSchema)
    .min(1)
    .optional()
    .describe("Séquence de posts à publier avec dates, descriptions d'images et textes (pour réseaux sociaux)"),
  emails: z
    .array(detailedEmailSchema)
    .min(1)
    .optional()
    .describe("Séquence d'emails à envoyer avec dates, sujets et corps (pour canal Email)"),
}).refine(
  (data) => (data.posts !== undefined && data.posts.length > 0) || (data.emails !== undefined && data.emails.length > 0),
  {
    message: "Le plan doit contenir soit des posts, soit des emails",
  }
);

export type DetailedPlanInput = z.infer<typeof detailedPlanSchema>;

export const landingPageSiteSchema = z.object({
  html: z.string().describe("Contenu complet du fichier index.html, incluant <html>, <head> et <body>"),
  css: z.string().describe("Contenu complet du fichier styles.css pour la landing page"),
});

export type LandingPageSiteInput = z.infer<typeof landingPageSiteSchema>;