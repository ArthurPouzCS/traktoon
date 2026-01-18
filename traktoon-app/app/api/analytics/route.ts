import { NextResponse } from 'next/server';
import {
  getAllPosts,
  getStats,
  getDashboardSummary,
  analyzeAllChannels,
  trackPost,
  type Channel,
} from '@/lib/analytics';

/**
 * GET /api/analytics
 * 
 * Get analytics overview
 * Query params:
 *   - view: 'summary' | 'full' | 'posts' (default: 'summary')
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'summary';
    
    switch (view) {
      case 'summary':
        return NextResponse.json({
          success: true,
          data: getDashboardSummary(),
        });
        
      case 'full':
        return NextResponse.json({
          success: true,
          data: analyzeAllChannels(),
        });
        
      case 'posts':
        return NextResponse.json({
          success: true,
          data: {
            posts: getAllPosts(),
            stats: getStats(),
          },
        });
        
      default:
        return NextResponse.json({
          success: true,
          data: getDashboardSummary(),
        });
    }
    
  } catch (error) {
    console.error('[Analytics API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics
 * 
 * Manually track a post
 * Body: { channel, platformPostId, platformUrl, content, target?, campaign? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const { channel, platformPostId, platformUrl, content, target, campaign } = body;
    
    if (!channel || !platformPostId || !content) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: channel, platformPostId, content' },
        { status: 400 }
      );
    }
    
    const post = await trackPost({
      channel: channel as Channel,
      platformPostId,
      platformUrl: platformUrl || `https://x.com/i/status/${platformPostId}`,
      content,
      target,
      campaign,
    });
    
    return NextResponse.json({
      success: true,
      data: post,
    });
    
  } catch (error) {
    console.error('[Analytics API] Error tracking post:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to track post' },
      { status: 500 }
    );
  }
}

