/**
 * X (Twitter) Token Manager
 * Handles OAuth 2.0 tokens with automatic refresh
 */

const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp
}

// In-memory token storage (in production, use Redis or DB)
let tokenData: TokenData | null = null;

/**
 * Initialize tokens from environment or stored values
 */
export function initializeTokens(accessToken: string, refreshToken: string, expiresIn: number = 7200) {
  tokenData = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Date.now() + (expiresIn * 1000) - 60000, // 1 min buffer
  };
  console.log('[TokenManager] Tokens initialized, expires at:', new Date(tokenData.expires_at).toISOString());
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidAccessToken(): Promise<string> {
  // If no tokens, try to load from env
  if (!tokenData) {
    const envAccessToken = process.env.X_ACCESS_TOKEN;
    const envRefreshToken = process.env.X_REFRESH_TOKEN;
    
    if (envAccessToken) {
      tokenData = {
        access_token: envAccessToken,
        refresh_token: envRefreshToken || '',
        expires_at: Date.now() + (7200 * 1000), // Assume 2 hours from now
      };
    } else {
      throw new Error('No X access token available. Please authorize first.');
    }
  }

  // Check if token is expired or about to expire (5 min buffer)
  const isExpired = Date.now() > tokenData.expires_at - 300000;
  
  if (isExpired && tokenData.refresh_token) {
    console.log('[TokenManager] Token expired or expiring soon, refreshing...');
    await refreshAccessToken();
  }

  return tokenData.access_token;
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(): Promise<void> {
  if (!tokenData?.refresh_token) {
    throw new Error('No refresh token available');
  }

  const clientId = process.env.X_CLIENT_ID!;
  const clientSecret = process.env.X_CLIENT_SECRET!;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('refresh_token', tokenData.refresh_token);

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[TokenManager] Refresh failed:', data);
      throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
    }

    // Update stored tokens
    tokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || tokenData.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000) - 60000,
    };

    console.log('[TokenManager] Token refreshed successfully, new expiry:', new Date(tokenData.expires_at).toISOString());
  } catch (error) {
    console.error('[TokenManager] Refresh error:', error);
    throw error;
  }
}

/**
 * Store new tokens (called after OAuth callback)
 */
export function storeTokens(accessToken: string, refreshToken: string, expiresIn: number) {
  initializeTokens(accessToken, refreshToken, expiresIn);
}

/**
 * Check if we have valid tokens
 */
export function hasValidTokens(): boolean {
  return tokenData !== null && tokenData.access_token !== '';
}

/**
 * Get current token info (for debugging)
 */
export function getTokenInfo() {
  if (!tokenData) return null;
  return {
    hasAccessToken: !!tokenData.access_token,
    hasRefreshToken: !!tokenData.refresh_token,
    expiresAt: new Date(tokenData.expires_at).toISOString(),
    isExpired: Date.now() > tokenData.expires_at,
  };
}

