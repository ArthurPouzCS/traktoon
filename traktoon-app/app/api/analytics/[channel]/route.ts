import { NextResponse } from 'next/server';
import {
  analyzeChannel,
  getPostsByChannel,
  refreshChannelMetrics,
  type Channel,
} from '@/lib/analytics';

const VALID_CHANNELS: Channel[] = ['X', 'LinkedIn', 'Instagram', 'TikTok', 'Email'];

/**
 * GET /api/analytics/[channel]
 * 
 * Get analytics for a specific channel
 * Query params:
 *   - refresh: 'true' to fetch fresh metrics before analyzing
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ channel: string }> }
) {
  try {
    const { channel } = await params;
    const channelUpper = channel.toUpperCase() as Channel;
    
    // Validate channel
    if (!VALID_CHANNELS.includes(channelUpper) && channel !== 'X') {
      // Handle 'x' lowercase
      const normalizedChannel = channel.toLowerCase() === 'x' ? 'X' : channelUpper;
      if (!VALID_CHANNELS.includes(normalizedChannel)) {
        return NextResponse.json(
          { success: false, error: `Invalid channel: ${channel}` },
          { status: 400 }
        );
      }
    }
    
    const normalizedChannel: Channel = channel.toLowerCase() === 'x' ? 'X' : channelUpper;
    
    // Check if we should refresh metrics first
    const { searchParams } = new URL(request.url);
    const shouldRefresh = searchParams.get('refresh') === 'true';
    
    if (shouldRefresh) {
      console.log('[Analytics API] Refreshing metrics for', normalizedChannel);
      await refreshChannelMetrics(normalizedChannel);
    }
    
    const analytics = analyzeChannel(normalizedChannel);
    const posts = getPostsByChannel(normalizedChannel);
    
    return NextResponse.json({
      success: true,
      data: {
        analytics,
        posts: posts.map(p => ({
          id: p.id,
          content: p.content.substring(0, 100),
          postedAt: p.postedAt,
          metrics: p.metrics,
          performance: p.performance,
          status: p.status,
          platformUrl: p.platformUrl,
        })),
      },
    });
    
  } catch (error) {
    console.error('[Analytics API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch channel analytics' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/[channel]/refresh
 * 
 * Refresh all metrics for a channel
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ channel: string }> }
) {
  try {
    const { channel } = await params;
    const normalizedChannel: Channel = channel.toLowerCase() === 'x' ? 'X' : channel.toUpperCase() as Channel;
    
    const updated = await refreshChannelMetrics(normalizedChannel);
    
    return NextResponse.json({
      success: true,
      message: `Refreshed metrics for ${updated} posts`,
      updated,
    });
    
  } catch (error) {
    console.error('[Analytics API] Error refreshing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refresh metrics' },
      { status: 500 }
    );
  }
}

