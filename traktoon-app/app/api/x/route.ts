import { NextResponse } from 'next/server';

const TWEET_ENDPOINT = 'https://api.twitter.com/2/tweets';

export async function POST(request: Request) {
  const { text } = await request.json();

  if (!text) {
    return NextResponse.json({ error: 'Missing text field' }, { status: 400 });
  }

  const accessToken = process.env.X_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'No access token configured. Please authorize first.' },
      { status: 401 }
    );
  }

  console.log('[X API] Posting tweet with OAuth 2.0 Bearer token...');
  console.log('[X API] Tweet text:', text);

  const response = await fetch(TWEET_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  const data = await response.json();

  console.log('[X API] Status:', response.status);
  console.log('[X API] Response:', JSON.stringify(data, null, 2));

  if (!response.ok) {
    return NextResponse.json({ error: data }, { status: response.status });
  }

  return NextResponse.json({ success: true, data });
}
