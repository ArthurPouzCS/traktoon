import { NextResponse } from 'next/server';

// OAuth 2.0 Callback Handler
// Receives the authorization code from X and exchanges it for tokens

const CLIENT_ID = process.env.X_CLIENT_ID!;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET!;
const REDIRECT_URI = process.env.X_REDIRECT_URI || 'http://localhost:3000/api/x/callback';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';

// Store code verifiers temporarily (in production, use Redis or similar)
const codeVerifiers = new Map<string, string>();

export function storeCodeVerifier(state: string, codeVerifier: string) {
  codeVerifiers.set(state, codeVerifier);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  console.log('[Callback] Received:', { code: code?.substring(0, 20) + '...', state, error });

  if (error) {
    return new NextResponse(`
      <html>
        <head><title>Error</title></head>
        <body style="font-family: sans-serif; padding: 40px; background: #1a1a1a; color: white;">
          <h1>❌ Authorization Error</h1>
          <p>${error}: ${url.searchParams.get('error_description')}</p>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }

  if (!code) {
    return NextResponse.json({ error: 'No code received' }, { status: 400 });
  }

  // Return the code and instructions for manual exchange
  // The frontend will handle the exchange using localStorage code_verifier
  return new NextResponse(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Authorization Successful!</title>
        <style>
          body { font-family: sans-serif; padding: 40px; background: #1a1a1a; color: white; }
          pre { background: #333; padding: 20px; border-radius: 8px; overflow-x: auto; }
          .success { color: #4ade80; }
          button { background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; margin: 10px 5px; }
          button:hover { background: #2563eb; }
          #result { margin-top: 20px; padding: 20px; border-radius: 8px; }
          .token-display { word-break: break-all; background: #065f46; padding: 15px; border-radius: 8px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <h1 class="success">✅ Authorization successful!</h1>
        <p>Code received! Click the button to exchange it for an access token:</p>
        
        <button onclick="exchangeToken()">🔄 Get Access Token</button>
        <button onclick="window.close()">❌ Close</button>
        
        <div id="result"></div>
        
        <script>
          const code = "${code}";
          
          async function exchangeToken() {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = '<p>⏳ Exchanging code for token...</p>';
            
            // Get code verifier from localStorage (set by the main page)
            const codeVerifier = localStorage.getItem('x_code_verifier');
            
            if (!codeVerifier) {
              resultDiv.innerHTML = '<p style="color: #ef4444;">❌ No code verifier found in localStorage! Go back to the main page and try again.</p>';
              return;
            }
            
            try {
              const response = await fetch('/api/x/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, codeVerifier })
              });
              
              const data = await response.json();
              
              if (data.access_token) {
                resultDiv.innerHTML = \`
                  <h2 class="success">🎉 Token received!</h2>
                  <p>Copy this access token and save it:</p>
                  <div class="token-display">
                    <strong>Access Token:</strong><br>
                    <code>\${data.access_token}</code>
                  </div>
                  <div class="token-display">
                    <strong>Refresh Token:</strong><br>
                    <code>\${data.refresh_token || 'N/A'}</code>
                  </div>
                  <p>Expires in: \${data.expires_in} seconds</p>
                  <button onclick="copyToken('\${data.access_token}')">📋 Copy Access Token</button>
                \`;
                
                // Store in localStorage for the main app
                localStorage.setItem('x_access_token', data.access_token);
                if (data.refresh_token) {
                  localStorage.setItem('x_refresh_token', data.refresh_token);
                }
              } else {
                resultDiv.innerHTML = \`<p style="color: #ef4444;">❌ Error: \${JSON.stringify(data.error)}</p>\`;
              }
            } catch (err) {
              resultDiv.innerHTML = \`<p style="color: #ef4444;">❌ Network error: \${err}</p>\`;
            }
          }
          
          function copyToken(token) {
            navigator.clipboard.writeText(token);
            alert('Token copied to clipboard!');
          }
        </script>
      </body>
    </html>
  `, { headers: { 'Content-Type': 'text/html' } });
}
