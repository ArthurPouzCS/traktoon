/**
 * Génère l'URL de redirection pour OAuth en utilisant la base URL configurée
 * Utilise NEXT_PUBLIC_BASE_URL ou VERCEL_URL en production, ou localhost en dev
 */
export function getRedirectUri(path: string): string {
  // Vérifier NEXT_PUBLIC_BASE_URL en premier
  let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL;

  // Si pas de base URL explicite, utiliser VERCEL_URL en production
  if (!baseUrl) {
    if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      baseUrl = "http://localhost:3000";
    }
  }

  // Nettoyer la base URL (enlever le trailing slash si présent)
  const cleanedBaseUrl = baseUrl.replace(/\/$/, "");
  // S'assurer que le path commence par /
  const cleanedPath = path.startsWith("/") ? path : `/${path}`;

  const finalUrl = `${cleanedBaseUrl}${cleanedPath}`;
  
  // Debug en développement
  if (process.env.NODE_ENV !== "production") {
    console.log("[Redirect URI Debug]", {
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
      BASE_URL: process.env.BASE_URL,
      VERCEL_URL: process.env.VERCEL_URL,
      finalBaseUrl: cleanedBaseUrl,
      finalUrl,
    });
  }

  return finalUrl;
}

/**
 * Génère l'URL de redirection pour Reddit OAuth
 */
export function getRedditRedirectUri(): string {
  return getRedirectUri("/api/auth/reddit/callback");
}

/**
 * Génère l'URL de redirection pour Instagram OAuth
 */
export function getInstagramRedirectUri(): string {
  return getRedirectUri("/api/auth/instagram/callback");
}

/**
 * Génère l'URL de redirection pour X (Twitter) OAuth
 */
export function getXRedirectUri(): string {
  return getRedirectUri("/api/x/callback");
}