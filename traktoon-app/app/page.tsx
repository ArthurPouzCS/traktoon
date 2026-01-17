'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [tweetText, setTweetText] = useState('');
  const [tweetResult, setTweetResult] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Add log helper
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);
    setLogs(prev => [...prev, logEntry]);
  };

  // Check for callback params on mount
  useEffect(() => {
    addLog('🚀 App loaded');
    
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (error) {
      addLog(`❌ OAuth error: ${error}`);
    }
    
    if (code) {
      addLog(`✅ OAuth code received: ${code.substring(0, 20)}...`);
      
      // Get code verifier from localStorage
      const codeVerifier = localStorage.getItem('x_code_verifier');
      if (codeVerifier) {
        addLog(`🔐 Code verifier found in localStorage`);
        exchangeCodeForToken(code, codeVerifier);
      } else {
        addLog(`❌ No code verifier in localStorage!`);
      }
    }
  }, []);

  // Exchange code for token
  const exchangeCodeForToken = async (code: string, codeVerifier: string) => {
    addLog(`🔄 Exchanging code for token...`);
    try {
      const res = await fetch('/api/x/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, codeVerifier }),
      });
      
      const data = await res.json();
      addLog(`📦 Token response: ${JSON.stringify(data).substring(0, 100)}...`);
      
      if (data.access_token) {
        setToken(data.access_token);
        addLog(`✅ Access token received!`);
        // Clear URL params
        window.history.replaceState({}, '', '/');
      } else {
        addLog(`❌ Error: ${JSON.stringify(data.error)}`);
      }
    } catch (error) {
      addLog(`❌ Exchange error: ${error}`);
    }
  };

  // Start OAuth flow
  const handleConnectX = async () => {
    setLoading(true);
    addLog('🔗 Starting OAuth flow...');
    
    try {
      addLog('📡 Fetching /api/x/auth...');
      const res = await fetch('/api/x/auth');
      const data = await res.json();
      
      addLog(`📦 Response received`);
      addLog(`🔐 Code Verifier: ${data.codeVerifier}`);
      
      // Store code verifier in localStorage for later
      localStorage.setItem('x_code_verifier', data.codeVerifier);
      addLog(`💾 Code Verifier saved to localStorage`);
      
      // Open in NEW TAB instead of redirecting
      addLog(`🔗 Opening X authorization in new tab...`);
      window.open(data.authUrl, '_blank');
      
      addLog(`✅ Auth tab opened! Complete authorization there.`);
      addLog(`⏳ Waiting for callback... (check the other tab)`);
      
      setLoading(false);
    } catch (error) {
      addLog(`❌ Error: ${error}`);
      setLoading(false);
    }
  };

  // Post a tweet
  const handlePostTweet = async () => {
    if (!tweetText.trim()) return;
    
    setLoading(true);
    setTweetResult(null);
    addLog(`📝 Posting tweet: "${tweetText.substring(0, 50)}..."`);
    
    try {
      addLog('📡 POST /api/x...');
      const res = await fetch('/api/x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: tweetText }),
      });
      
      const data = await res.json();
      addLog(`📦 Response status: ${res.status}`);
      addLog(`📦 Response data: ${JSON.stringify(data)}`);
      
      if (data.success) {
        setTweetResult('✅ Tweet posté avec succès !');
        addLog('✅ Tweet posted successfully!');
        setTweetText('');
      } else {
        setTweetResult(`❌ Erreur: ${JSON.stringify(data.error)}`);
        addLog(`❌ Tweet error: ${JSON.stringify(data.error)}`);
      }
    } catch (error) {
      addLog(`❌ Network error: ${error}`);
      setTweetResult('❌ Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  // Clear logs
  const clearLogs = () => setLogs([]);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Tractoon AI
          </h1>
          <p className="text-zinc-400">Test de l'API X (Twitter)</p>
        </div>

        {/* OAuth Section */}
        <div className="bg-zinc-900 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">1. Connexion OAuth 2.0</h2>
          <p className="text-zinc-400 text-sm">
            Clique pour autoriser l'app à poster sur ton compte X
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleConnectX}
              disabled={loading}
              className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-700 text-white font-medium py-3 px-6 rounded-xl transition-colors"
            >
              {loading ? '⏳ Chargement...' : '🔗 Connecter mon compte X'}
            </button>
            <button
              onClick={() => {
                const codeVerifier = localStorage.getItem('x_code_verifier');
                if (codeVerifier) {
                  addLog(`📋 Code Verifier in storage: ${codeVerifier}`);
                } else {
                  addLog(`❌ No Code Verifier in localStorage`);
                }
              }}
              className="bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-3 px-4 rounded-xl transition-colors"
              title="Check stored code verifier"
            >
              🔍
            </button>
          </div>
          
          {token && (
            <div className="bg-zinc-800 rounded-lg p-4">
              <p className="text-green-400 text-sm">✅ Token reçu !</p>
              <code className="text-xs text-zinc-400 break-all">{token}</code>
            </div>
          )}
        </div>

        {/* Tweet Section */}
        <div className="bg-zinc-900 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">2. Poster un Tweet</h2>
          <textarea
            value={tweetText}
            onChange={(e) => setTweetText(e.target.value)}
            placeholder="Écris ton tweet ici..."
            className="w-full bg-zinc-800 text-white rounded-xl p-4 h-32 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={280}
          />
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 text-sm">{tweetText.length}/280</span>
            <button
              onClick={handlePostTweet}
              disabled={loading || !tweetText.trim()}
              className="bg-green-500 hover:bg-green-600 disabled:bg-zinc-700 text-white font-medium py-2 px-6 rounded-xl transition-colors"
            >
              {loading ? '⏳ Envoi...' : '📤 Poster'}
            </button>
          </div>
          
          {tweetResult && (
            <div className={`rounded-lg p-4 ${tweetResult.includes('✅') ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
              <p className="text-sm">{tweetResult}</p>
            </div>
          )}
        </div>

        {/* Live Logs */}
        <div className="bg-zinc-900 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">📋 Logs en direct</h2>
            <button
              onClick={clearLogs}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded-lg"
            >
              Effacer
            </button>
          </div>
          <div className="bg-black rounded-xl p-4 h-64 overflow-y-auto font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-zinc-600">Aucun log pour l'instant...</p>
            ) : (
              logs.map((log, i) => (
                <p 
                  key={i} 
                  className={`py-0.5 ${
                    log.includes('❌') ? 'text-red-400' : 
                    log.includes('✅') ? 'text-green-400' : 
                    log.includes('🔗') || log.includes('📡') ? 'text-blue-400' :
                    'text-zinc-300'
                  }`}
                >
                  {log}
                </p>
              ))
            )}
          </div>
        </div>

        {/* API Info */}
        <div className="bg-zinc-900 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">🛠️ Endpoints API</h2>
          <div className="text-xs text-zinc-500 space-y-1 font-mono">
            <p>• GET  /api/x/auth     → Génère l'URL d'autorisation</p>
            <p>• GET  /api/x/callback → Reçoit le code OAuth</p>
            <p>• POST /api/x/token    → Échange code → token</p>
            <p>• POST /api/x          → Poste un tweet</p>
          </div>
        </div>
      </div>
    </div>
  );
}
