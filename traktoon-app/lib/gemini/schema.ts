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
