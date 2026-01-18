import { NextResponse } from 'next/server';
import { postTweet } from '@/lib/x/client';
import { getTokenInfo } from '@/lib/x/token-manager';

/**
 * POST /api/x
 * Post a tweet to X (Twitter)
 * 
 * Body: { text: string, mediaUrl?: string }
 */
export async function POST(request: Request) {
  try {
    const { text, mediaUrl } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Missing text field' }, { status: 400 });
    }

    const result = await postTweet({ text, mediaUrl });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        tweetId: result.tweetId,
        tweetUrl: result.tweetUrl,
      },
    });
  } catch (error) {
    console.error('[X API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to post tweet' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/x
 * Get current token status
 */
export async function GET() {
  const tokenInfo = getTokenInfo();
  
  return NextResponse.json({
    status: tokenInfo ? 'configured' : 'not_configured',
    tokenInfo,
  });
}
