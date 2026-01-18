/**
 * Analytics Types
 * Clean type definitions for multi-channel analytics
 */

// ============================================================
// CORE TYPES
// ============================================================

export type Channel = 'X' | 'LinkedIn' | 'Instagram' | 'TikTok' | 'Email';

export type PostStatus = 'pending' | 'posted' | 'failed' | 'analyzed';

// ============================================================
// METRICS
// ============================================================

/**
 * Raw metrics from a platform
 */
export interface PlatformMetrics {
  impressions: number;
  engagements: number;
  likes: number;
  shares: number;      // retweets on X, shares on LinkedIn, etc.
  comments: number;    // replies on X
  clicks: number;      // link clicks
  saves: number;       // bookmarks on X
  videoViews?: number; // for video content
}

/**
 * Calculated performance metrics
 */
export interface PerformanceMetrics {
  engagementRate: number;     // (engagements / impressions) * 100
  clickThroughRate: number;   // (clicks / impressions) * 100
  viralityScore: number;      // (shares / impressions) * 100
  interactionRate: number;    // (comments / impressions) * 100
}

// ============================================================
// POST TRACKING
// ============================================================

/**
 * A tracked post across any channel
 */
export interface TrackedPost {
  id: string;                      // Internal ID (uuid)
  channel: Channel;
  platformPostId: string;          // ID from the platform (tweet ID, etc.)
  platformUrl: string;             // Direct link to the post
  
  // Content
  content: string;
  contentType: 'text' | 'image' | 'video' | 'carousel';
  mediaUrls?: string[];
  
  // Targeting
  target: string;                  // Target audience (e.g., "Tech founders")
  campaign?: string;               // Campaign/sequence name
  
  // Timestamps
  postedAt: string;                // ISO timestamp
  lastFetchedAt?: string;          // When metrics were last fetched
  
  // Status
  status: PostStatus;
  
  // Metrics (updated over time)
  metrics?: PlatformMetrics;
  performance?: PerformanceMetrics;
  
  // Historical snapshots for trend analysis
  metricsHistory?: MetricsSnapshot[];
}

/**
 * Snapshot of metrics at a point in time
 */
export interface MetricsSnapshot {
  timestamp: string;
  metrics: PlatformMetrics;
}

// ============================================================
// ANALYSIS RESULTS
// ============================================================

/**
 * Comparison between posts
 */
export interface PostComparison {
  postId: string;
  content: string;
  performance: PerformanceMetrics;
  rank: number;
  percentile: number;        // How it ranks vs all posts (0-100)
  vsAverage: {
    engagementRate: number;  // +/- vs channel average
    impressions: number;
  };
}

/**
 * Channel-level analytics
 */
export interface ChannelAnalytics {
  channel: Channel;
  totalPosts: number;
  
  // Aggregate metrics
  totalImpressions: number;
  totalEngagements: number;
  avgEngagementRate: number;
  
  // Best/worst performers
  topPerformers: PostComparison[];
  underperformers: PostComparison[];
  
  // Trends
  trend: 'improving' | 'stable' | 'declining';
  trendPercentage: number;
}

/**
 * Cross-channel comparison
 */
export interface MultiChannelAnalysis {
  analyzedAt: string;
  channels: ChannelAnalytics[];
  
  // Cross-channel insights
  bestChannel: Channel;
  bestChannelReason: string;
  
  recommendations: Recommendation[];
}

/**
 * AI-generated recommendation
 */
export interface Recommendation {
  type: 'content' | 'timing' | 'channel' | 'audience';
  priority: 'high' | 'medium' | 'low';
  channel?: Channel;
  insight: string;
  action: string;
  basedOn: string[];  // Post IDs or data points this is based on
}

// ============================================================
// API TYPES
// ============================================================

export interface TrackPostRequest {
  channel: Channel;
  platformPostId: string;
  platformUrl: string;
  content: string;
  contentType?: 'text' | 'image' | 'video' | 'carousel';
  target?: string;
  campaign?: string;
}

export interface AnalyticsResponse {
  success: boolean;
  data?: MultiChannelAnalysis | ChannelAnalytics | TrackedPost[];
  error?: string;
}

