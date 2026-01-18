/**
 * Temporary PKCE store
 * Maps state -> code_verifier for OAuth flow
 * In production, use Redis or similar with TTL
 */

const pkceStore = new Map<string, { codeVerifier: string; createdAt: number }>();

// Clean up old entries (older than 10 minutes)
function cleanup() {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [state, data] of pkceStore.entries()) {
    if (data.createdAt < tenMinutesAgo) {
      pkceStore.delete(state);
    }
  }
}

export function storeCodeVerifier(state: string, codeVerifier: string) {
  cleanup();
  pkceStore.set(state, { codeVerifier, createdAt: Date.now() });
  console.log(`[PKCE Store] Stored code_verifier for state: ${state.substring(0, 8)}...`);
}

export function getCodeVerifier(state: string): string | null {
  const data = pkceStore.get(state);
  if (data) {
    pkceStore.delete(state); // One-time use
    console.log(`[PKCE Store] Retrieved code_verifier for state: ${state.substring(0, 8)}...`);
    return data.codeVerifier;
  }
  console.log(`[PKCE Store] No code_verifier found for state: ${state.substring(0, 8)}...`);
  return null;
}

