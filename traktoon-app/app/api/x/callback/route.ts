import { NextResponse } from 'next/server';
import { getCodeVerifier } from '@/lib/x/pkce-store';
import { storeTokens } from '@/lib/x/token-manager';

// OAuth 2.0 Callback Handler
// Automatically exchanges code for tokens using stored code_verifier

const CLIENT_ID = process.env.X_CLIENT_ID!;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET!;
const REDIRECT_URI = process.env.X_REDIRECT_URI || 'http://localhost:3000/api/x/callback';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  console.log('[Callback] Received:', { 
    code: code?.substring(0, 20) + '...', 
    state: state?.substring(0, 8) + '...', 
    error 
  });

  if (error) {
    return htmlResponse(`
      <h1>❌ Authorization Error</h1>
      <p>${error}: ${url.searchParams.get('error_description')}</p>
      <a href="/">← Back to app</a>
    `, false);
  }

  if (!code || !state) {
    return htmlResponse(`
      <h1>❌ Missing Parameters</h1>
      <p>No code or state received from X.</p>
      <a href="/">← Back to app</a>
    `, false);
  }

  // Retrieve the code_verifier using the state
  const codeVerifier = getCodeVerifier(state);
  
  if (!codeVerifier) {
    return htmlResponse(`
      <h1>❌ Session Expired</h1>
      <p>The authorization session has expired or the state doesn't match.</p>
      <p>Please try authorizing again from the main page.</p>
      <a href="/">← Back to app</a>
    `, false);
  }

  // Exchange code for tokens
  console.log('[Callback] Exchanging code for tokens...');
  
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const params = new URLSearchParams();
  params.set('grant_type', 'authorization_code');
  params.set('code', code);
  params.set('redirect_uri', REDIRECT_URI);
  params.set('code_verifier', codeVerifier);

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
      console.error('[Callback] Token exchange failed:', data);
      return htmlResponse(`
        <h1>❌ Token Exchange Failed</h1>
        <p>Error: ${data.error}</p>
        <p>${data.error_description || ''}</p>
        <a href="/">← Back to app</a>
      `, false);
    }

    // Store tokens for auto-refresh
    storeTokens(data.access_token, data.refresh_token, data.expires_in);

    console.log('[Callback] ✅ Tokens received and stored!');
    console.log('[Callback] Access token:', data.access_token.substring(0, 30) + '...');

    return htmlResponse(`
      <h1>✅ Authorization Successful!</h1>
      <p>Tokens have been received and stored. You can now post tweets!</p>
      <div class="token-box">
        <strong>Access Token:</strong><br>
        <code>${data.access_token}</code>
      </div>
      <div class="token-box">
        <strong>Refresh Token:</strong><br>
        <code>${data.refresh_token || 'N/A'}</code>
      </div>
      <p>Expires in: ${data.expires_in} seconds (${Math.round(data.expires_in / 60)} minutes)</p>
      <button onclick="navigator.clipboard.writeText('${data.access_token}'); alert('Copied!')">
        📋 Copy Access Token
      </button>
      <a href="/" class="btn">← Back to App</a>
    `, true);

  } catch (err) {
    console.error('[Callback] Network error:', err);
    return htmlResponse(`
      <h1>❌ Network Error</h1>
      <p>Failed to exchange code for tokens.</p>
      <p>${err instanceof Error ? err.message : 'Unknown error'}</p>
      <a href="/">← Back to app</a>
    `, false);
  }
}

function htmlResponse(content: string, success: boolean) {
  return new NextResponse(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${success ? 'Success' : 'Error'} - X OAuth</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #0a0a0a;
          color: white;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
        }
        h1 { color: ${success ? '#4ade80' : '#ef4444'}; }
        .token-box {
          background: #1a1a1a;
          border: 1px solid #333;
          padding: 15px;
          border-radius: 8px;
          margin: 15px 0;
          word-break: break-all;
        }
        code {
          color: #60a5fa;
          font-size: 12px;
        }
        button, .btn {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          margin: 5px;
          text-decoration: none;
          display: inline-block;
        }
        button:hover, .btn:hover { background: #2563eb; }
        a { color: #60a5fa; }
      </style>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' },
  });
}
