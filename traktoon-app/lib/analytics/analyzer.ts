/**
 * Analytics Analyzer
 * Compares performance within and across channels
 */

import type {
  TrackedPost,
  Channel,
  ChannelAnalytics,
  MultiChannelAnalysis,
  PostComparison,
  Recommendation,
  PerformanceMetrics,
} from './types';
import * as store from './store';

// ============================================================
// SINGLE CHANNEL ANALYSIS
// ============================================================

/**
 * Analyze all posts for a specific channel
 */
export function analyzeChannel(channel: Channel): ChannelAnalytics {
  const posts = store.getPostsByChannel(channel);
  const analyzedPosts = posts.filter(p => p.metrics && p.performance);
  
  if (analyzedPosts.length === 0) {
    return {
      channel,
      totalPosts: posts.length,
      totalImpressions: 0,
      totalEngagements: 0,
      avgEngagementRate: 0,
      topPerformers: [],
      underperformers: [],
      trend: 'stable',
      trendPercentage: 0,
    };
  }
  
  // Aggregate metrics
  const totalImpressions = analyzedPosts.reduce(
    (sum, p) => sum + (p.metrics?.impressions || 0), 0
  );
  const totalEngagements = analyzedPosts.reduce(
    (sum, p) => sum + (p.metrics?.engagements || 0), 0
  );
  const avgEngagementRate = totalImpressions > 0
    ? (totalEngagements / totalImpressions) * 100
    : 0;
  
  // Rank posts by engagement rate
  const comparisons = createPostComparisons(analyzedPosts, avgEngagementRate);
  
  // Sort by rank
  comparisons.sort((a, b) => a.rank - b.rank);
  
  // Get top 3 and bottom 3
  const topPerformers = comparisons.slice(0, 3);
  const underperformers = comparisons.slice(-3).reverse();
  
  // Calculate trend (compare recent vs older posts)
  const trend = calculateTrend(analyzedPosts);
  
  return {
    channel,
    totalPosts: posts.length,
    totalImpressions,
    totalEngagements,
    avgEngagementRate,
    topPerformers,
    underperformers,
    trend: trend.direction,
    trendPercentage: trend.percentage,
  };
}

// ============================================================
// MULTI-CHANNEL ANALYSIS
// ============================================================

/**
 * Analyze and compare all channels
 */
export function analyzeAllChannels(): MultiChannelAnalysis {
  const allPosts = store.getAllPosts();
  
  // Get unique channels
  const channels = [...new Set(allPosts.map(p => p.channel))];
  
  // Analyze each channel
  const channelAnalytics = channels.map(channel => analyzeChannel(channel));
  
  // Find best performing channel
  const bestChannel = findBestChannel(channelAnalytics);
  
  // Generate recommendations
  const recommendations = generateRecommendations(channelAnalytics, allPosts);
  
  return {
    analyzedAt: new Date().toISOString(),
    channels: channelAnalytics,
    bestChannel: bestChannel.channel,
    bestChannelReason: bestChannel.reason,
    recommendations,
  };
}

// ============================================================
// POST COMPARISON
// ============================================================

/**
 * Create comparison objects for posts
 */
function createPostComparisons(
  posts: TrackedPost[],
  avgEngagementRate: number
): PostComparison[] {
  // Sort by engagement rate to assign ranks
  const sorted = [...posts].sort(
    (a, b) => (b.performance?.engagementRate || 0) - (a.performance?.engagementRate || 0)
  );
  
  return sorted.map((post, index) => {
    const performance = post.performance || {
      engagementRate: 0,
      clickThroughRate: 0,
      viralityScore: 0,
      interactionRate: 0,
    };
    
    const avgImpressions = posts.reduce(
      (sum, p) => sum + (p.metrics?.impressions || 0), 0
    ) / posts.length;
    
    return {
      postId: post.id,
      content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
      performance,
      rank: index + 1,
      percentile: ((posts.length - index) / posts.length) * 100,
      vsAverage: {
        engagementRate: performance.engagementRate - avgEngagementRate,
        impressions: (post.metrics?.impressions || 0) - avgImpressions,
      },
    };
  });
}

// ============================================================
// TREND ANALYSIS
// ============================================================

interface TrendResult {
  direction: 'improving' | 'stable' | 'declining';
  percentage: number;
}

/**
 * Calculate performance trend over time
 */
function calculateTrend(posts: TrackedPost[]): TrendResult {
  if (posts.length < 4) {
    return { direction: 'stable', percentage: 0 };
  }
  
  // Sort by posted date
  const sorted = [...posts].sort(
    (a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime()
  );
  
  // Split into old and recent
  const midpoint = Math.floor(sorted.length / 2);
  const oldPosts = sorted.slice(0, midpoint);
  const recentPosts = sorted.slice(midpoint);
  
  // Calculate average engagement rate for each half
  const oldAvg = calculateAvgEngagementRate(oldPosts);
  const recentAvg = calculateAvgEngagementRate(recentPosts);
  
  if (oldAvg === 0) {
    return { direction: 'stable', percentage: 0 };
  }
  
  const changePercent = ((recentAvg - oldAvg) / oldAvg) * 100;
  
  let direction: TrendResult['direction'];
  if (changePercent > 10) {
    direction = 'improving';
  } else if (changePercent < -10) {
    direction = 'declining';
  } else {
    direction = 'stable';
  }
  
  return { direction, percentage: changePercent };
}

function calculateAvgEngagementRate(posts: TrackedPost[]): number {
  const withPerformance = posts.filter(p => p.performance);
  if (withPerformance.length === 0) return 0;
  
  return withPerformance.reduce(
    (sum, p) => sum + (p.performance?.engagementRate || 0), 0
  ) / withPerformance.length;
}

// ============================================================
// BEST CHANNEL DETECTION
// ============================================================

interface BestChannelResult {
  channel: Channel;
  reason: string;
}

function findBestChannel(analytics: ChannelAnalytics[]): BestChannelResult {
  if (analytics.length === 0) {
    return { channel: 'X', reason: 'No data available yet' };
  }
  
  if (analytics.length === 1) {
    return { 
      channel: analytics[0].channel, 
      reason: 'Only channel with data' 
    };
  }
  
  // Score each channel
  const scored = analytics.map(a => ({
    channel: a.channel,
    score: calculateChannelScore(a),
    analytics: a,
  }));
  
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  
  // Generate reason
  let reason = `Highest overall score (${best.score.toFixed(1)})`;
  
  if (best.analytics.avgEngagementRate > 3) {
    reason = `Best engagement rate at ${best.analytics.avgEngagementRate.toFixed(2)}%`;
  } else if (best.analytics.trend === 'improving') {
    reason = `Improving trend (+${best.analytics.trendPercentage.toFixed(1)}%)`;
  } else if (best.analytics.totalImpressions > 10000) {
    reason = `Highest reach with ${best.analytics.totalImpressions.toLocaleString()} impressions`;
  }
  
  return { channel: best.channel, reason };
}

function calculateChannelScore(analytics: ChannelAnalytics): number {
  let score = 0;
  
  // Engagement rate weight: 40%
  score += Math.min(analytics.avgEngagementRate * 10, 40);
  
  // Reach weight: 30%
  const reachScore = Math.log10(analytics.totalImpressions + 1) * 5;
  score += Math.min(reachScore, 30);
  
  // Trend weight: 20%
  if (analytics.trend === 'improving') {
    score += 20;
  } else if (analytics.trend === 'stable') {
    score += 10;
  }
  
  // Consistency weight: 10%
  if (analytics.totalPosts >= 5) {
    score += 10;
  } else if (analytics.totalPosts >= 3) {
    score += 5;
  }
  
  return score;
}

// ============================================================
// RECOMMENDATIONS
// ============================================================

function generateRecommendations(
  analytics: ChannelAnalytics[],
  posts: TrackedPost[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  
  for (const channelData of analytics) {
    // Check for declining channels
    if (channelData.trend === 'declining') {
      recommendations.push({
        type: 'content',
        priority: 'high',
        channel: channelData.channel,
        insight: `${channelData.channel} engagement is declining by ${Math.abs(channelData.trendPercentage).toFixed(1)}%`,
        action: 'Review recent content strategy and compare with top performers',
        basedOn: channelData.underperformers.map(p => p.postId),
      });
    }
    
    // Check for low engagement
    if (channelData.avgEngagementRate < 1 && channelData.totalPosts >= 3) {
      recommendations.push({
        type: 'content',
        priority: 'medium',
        channel: channelData.channel,
        insight: `${channelData.channel} has low engagement rate (${channelData.avgEngagementRate.toFixed(2)}%)`,
        action: 'Try more engaging content formats: questions, polls, or visual content',
        basedOn: [],
      });
    }
    
    // Check for high-performing content patterns
    if (channelData.topPerformers.length > 0) {
      const topContent = channelData.topPerformers[0];
      if (topContent.performance.engagementRate > channelData.avgEngagementRate * 2) {
        recommendations.push({
          type: 'content',
          priority: 'medium',
          channel: channelData.channel,
          insight: `Top performing content outperforms average by ${topContent.vsAverage.engagementRate.toFixed(1)}%`,
          action: 'Analyze and replicate the style of your best performing content',
          basedOn: [topContent.postId],
        });
      }
    }
  }
  
  // Cross-channel recommendations
  if (analytics.length >= 2) {
    const sorted = [...analytics].sort(
      (a, b) => b.avgEngagementRate - a.avgEngagementRate
    );
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    
    if (best.avgEngagementRate > worst.avgEngagementRate * 2) {
      recommendations.push({
        type: 'channel',
        priority: 'high',
        insight: `${best.channel} performs ${(best.avgEngagementRate / worst.avgEngagementRate).toFixed(1)}x better than ${worst.channel}`,
        action: `Consider shifting more focus to ${best.channel} or improving ${worst.channel} strategy`,
        basedOn: [],
      });
    }
  }
  
  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return recommendations;
}

// ============================================================
// SPECIFIC POST ANALYSIS
// ============================================================

/**
 * Analyze how a specific post compares to others
 */
export function analyzePost(postId: string): PostComparison | null {
  const post = store.getPost(postId);
  if (!post || !post.performance) {
    return null;
  }
  
  const channelPosts = store.getPostsByChannel(post.channel);
  const analyzedPosts = channelPosts.filter(p => p.metrics && p.performance);
  
  if (analyzedPosts.length === 0) {
    return null;
  }
  
  const avgEngagementRate = calculateAvgEngagementRate(analyzedPosts);
  const comparisons = createPostComparisons(analyzedPosts, avgEngagementRate);
  
  return comparisons.find(c => c.postId === postId) || null;
}

/**
 * Get quick verdict on a post
 */
export function getPostVerdict(postId: string): {
  verdict: 'excellent' | 'good' | 'average' | 'poor';
  summary: string;
} {
  const comparison = analyzePost(postId);
  
  if (!comparison) {
    return { verdict: 'average', summary: 'Not enough data to analyze' };
  }
  
  let verdict: 'excellent' | 'good' | 'average' | 'poor';
  let summary: string;
  
  if (comparison.percentile >= 80) {
    verdict = 'excellent';
    summary = `Top ${(100 - comparison.percentile).toFixed(0)}% performer! +${comparison.vsAverage.engagementRate.toFixed(1)}% vs average`;
  } else if (comparison.percentile >= 50) {
    verdict = 'good';
    summary = `Above average performance, rank #${comparison.rank}`;
  } else if (comparison.percentile >= 20) {
    verdict = 'average';
    summary = `Average performance, ${comparison.vsAverage.engagementRate.toFixed(1)}% vs average`;
  } else {
    verdict = 'poor';
    summary = `Underperforming, ${comparison.vsAverage.engagementRate.toFixed(1)}% below average`;
  }
  
  return { verdict, summary };
}

