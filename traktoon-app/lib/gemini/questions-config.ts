import type { QuestionConfig } from "@/types/conversation";

export function generateQuestions(prompt: string): QuestionConfig[] {
  const lowerPrompt = prompt.toLowerCase();
  const questions: QuestionConfig[] = [];

  questions.push({
    id: "product-description",
    label: "Décrivez votre produit ou service en détail",
    type: "textarea",
    required: true,
    placeholder: "Ex: Une application mobile de fitness avec coaching personnalisé...",
  });

  questions.push({
    id: "target-audience",
    label: "Quelle est votre cible client précise ?",
    type: "textarea",
    required: true,
    placeholder: "Ex: Hommes et femmes de 25-45 ans, actifs, intéressés par le bien-être...",
  });

  questions.push({
    id: "budget",
    label: "Quel est votre budget marketing approximatif ?",
    type: "text",
    required: false,
    placeholder: "Ex: 5000€/mois, limité, illimité...",
  });

  if (lowerPrompt.includes("b2b") || lowerPrompt.includes("entreprise") || lowerPrompt.includes("business")) {
    questions.push({
      id: "decision-maker",
      label: "Qui est le décideur dans votre processus d'achat ?",
      type: "text",
      required: false,
      placeholder: "Ex: CEO, CTO, Directeur Marketing...",
    });
  }

  if (lowerPrompt.includes("saas") || lowerPrompt.includes("logiciel") || lowerPrompt.includes("app")) {
    questions.push({
      id: "pricing-model",
      label: "Quel est votre modèle de pricing ?",
      type: "text",
      required: false,
      placeholder: "Ex: Freemium, Abonnement mensuel, Usage-based...",
    });
  }

  if (lowerPrompt.includes("e-commerce") || lowerPrompt.includes("vente") || lowerPrompt.includes("produit physique")) {
    questions.push({
      id: "price-range",
      label: "Quelle est la fourchette de prix de votre produit ?",
      type: "text",
      required: false,
      placeholder: "Ex: 20-50€, Premium 200€+, etc.",
    });
  }

  questions.push({
    id: "main-objective",
    label: "Quel est votre objectif principal ?",
    type: "text",
    required: true,
    placeholder: "Ex: Générer des leads, Augmenter les ventes, Notoriété de marque...",
  });

  questions.push({
    id: "timeline",
    label: "Quel est votre délai pour lancer la campagne ?",
    type: "text",
    required: false,
    placeholder: "Ex: Immédiat, 1 mois, 3 mois...",
  });

  return questions;
}
