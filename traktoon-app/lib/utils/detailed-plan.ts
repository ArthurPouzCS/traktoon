"use client";

import { useState, useEffect } from "react";

/**
 * Formate un compte à rebours depuis maintenant jusqu'à la date cible
 * @param targetDate Date cible au format ISO string
 * @returns String formaté (ex: "3 jours, 2 heures, 15 minutes" ou "Terminé")
 */
export function formatCountdown(targetDate: string): string {
  const now = new Date();
  const target = new Date(targetDate);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) {
    return "Terminé";
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days} jour${days > 1 ? "s" : ""}`);
  }
  if (hours > 0) {
    parts.push(`${hours} heure${hours > 1 ? "s" : ""}`);
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
  }

  return parts.join(", ");
}

/**
 * Copie un texte dans le presse-papiers
 * @param text Texte à copier
 * @returns Promise qui se résout en cas de succès
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    // Fallback pour les navigateurs plus anciens
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
    } catch (err) {
      throw new Error("Impossible de copier le texte");
    }
    document.body.removeChild(textArea);
  }
}

/**
 * Hook React pour un compte à rebours qui se met à jour toutes les 60 secondes
 * @param targetDate Date cible au format ISO string
 * @returns String formaté du compte à rebours
 */
export function useCountdown(targetDate: string): string {
  const [countdown, setCountdown] = useState<string>(formatCountdown(targetDate));

  useEffect(() => {
    // Mise à jour immédiate
    setCountdown(formatCountdown(targetDate));

    // Mise à jour toutes les 60 secondes
    const interval = setInterval(() => {
      setCountdown(formatCountdown(targetDate));
    }, 60000); // 60 secondes

    return () => clearInterval(interval);
  }, [targetDate]);

  return countdown;
}

/**
 * Parse les emails d'un texte multi-ligne
 * Supporte les séparateurs : virgule, point-virgule, retour à la ligne
 * @param text Texte contenant les emails (séparés par virgule, point-virgule ou retour à la ligne)
 * @returns Tableau d'emails parsés et nettoyés
 */
export function parseEmails(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Remplacer les retours à la ligne par des virgules pour normaliser
  const normalized = text.replace(/\n/g, ',');
  
  // Split par virgule ou point-virgule
  const emails = normalized
    .split(/[,;]/)
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

  return emails;
}