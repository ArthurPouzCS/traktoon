/**
 * Analytics Module
 * 
 * Track, analyze, and compare post performance across channels
 * 
 * Usage:
 *   import { trackPost, fetchAndUpdateMetrics, analyzeChannel } from '@/lib/analytics';
 */

// Types
export * from './types';

// Store operations
export {
  addPost,
  getPost,
  getPostByPlatformId,
  getAllPosts,
  getPostsByChannel,
  getPostsByCampaign,
  updatePostMetrics,
  updatePostStatus,
  deletePost,
  clearAll,
  getStats,
  generateId,
} from './store';

// Analysis
export {
  analyzeChannel,
  analyzeAllChannels,
  analyzePost,
  getPostVerdict,
} from './analyzer';

// X Collector
export {
  fetchTweetMetrics,
  fetchMultipleTweetMetrics,
  extractTweetId,
} from './collectors/x-collector';

// ============================================================
// HIGH-LEVEL CONVENIENCE FUNCTIONS
// ============================================================

import * as store from './store';
import * as analyzer from './analyzer';
import { fetchTweetMetrics } from './collectors/x-collector';
import type { TrackedPost, Channel, PlatformMetrics } from './types';

/**
 * Track a new post and immediately try to fetch its metrics
 */
export async function trackPost(params: {
  channel: Channel;
  platformPostId: string;
  platformUrl: string;
  content: string;
  target?: string;
  campaign?: string;
}): Promise<TrackedPost> {
  // Add the post to the store
  const post = store.addPost({
    channel: params.channel,
    platformPostId: params.platformPostId,
    platformUrl: params.platformUrl,
    content: params.content,
    contentType: 'text',
    target: params.target || 'General',
    campaign: params.campaign,
    postedAt: new Date().toISOString(),
    status: 'posted',
  });
  
  console.log('[Analytics] Tracking new post:', post.id);
  
  // Try to fetch initial metrics (might be 0 for new posts)
  await fetchAndUpdateMetrics(post.id);
  
  return post;
}

/**
 * Fetch fresh metrics for a tracked post
 */
export async function fetchAndUpdateMetrics(postId: string): Promise<TrackedPost | null> {
  const post = store.getPost(postId);
  if (!post) {
    console.error('[Analytics] Post not found:', postId);
    return null;
  }
  
  let metrics: PlatformMetrics | null = null;
  
  // Fetch metrics based on channel
  if (post.channel === 'X') {
    metrics = await fetchTweetMetrics(post.platformPostId);
  } else {
    console.log('[Analytics] Collector not implemented for channel:', post.channel);
    return post;
  }
  
  if (metrics) {
    return store.updatePostMetrics(postId, metrics) || null;
  }
  
  return post;
}

/**
 * Refresh metrics for all posts in a channel
 */
export async function refreshChannelMetrics(channel: Channel): Promise<number> {
  const posts = store.getPostsByChannel(channel);
  let updated = 0;
  
  for (const post of posts) {
    const result = await fetchAndUpdateMetrics(post.id);
    if (result && result.metrics) {
      updated++;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('[Analytics] Refreshed', updated, 'posts for', channel);
  return updated;
}

/**
 * Get a quick summary for the dashboard
 */
export function getDashboardSummary() {
  const stats = store.getStats();
  const analysis = analyzer.analyzeAllChannels();
  
  return {
    stats,
    bestChannel: analysis.bestChannel,
    bestChannelReason: analysis.bestChannelReason,
    topRecommendation: analysis.recommendations[0] || null,
    channels: analysis.channels.map(c => ({
      channel: c.channel,
      posts: c.totalPosts,
      impressions: c.totalImpressions,
      engagement: c.avgEngagementRate.toFixed(2) + '%',
      trend: c.trend,
    })),
  };
}

