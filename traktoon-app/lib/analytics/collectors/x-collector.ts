/**
 * X (Twitter) Metrics Collector
 * Fetches engagement metrics from the X API v2
 */

import { getValidAccessToken } from '@/lib/x/token-manager';
import type { PlatformMetrics } from '../types';

// ============================================================
// X API ENDPOINTS
// ============================================================

const TWEET_ENDPOINT = 'https://api.twitter.com/2/tweets';

// Metrics we want to fetch
const TWEET_FIELDS = [
  'public_metrics',      // likes, retweets, replies, quotes
  'non_public_metrics',  // impressions, clicks (requires user auth)
  'organic_metrics',     // organic engagement
  'created_at',
].join(',');

// ============================================================
// TYPES
// ============================================================

interface XPublicMetrics {
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
  bookmark_count?: number;
  impression_count?: number;
}

interface XNonPublicMetrics {
  impression_count?: number;
  url_link_clicks?: number;
  user_profile_clicks?: number;
}

interface XTweetData {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: XPublicMetrics;
  non_public_metrics?: XNonPublicMetrics;
  organic_metrics?: XPublicMetrics;
}

interface XAPIResponse {
  data?: XTweetData;
  errors?: Array<{ message: string; type: string }>;
}

// ============================================================
// COLLECTOR
// ============================================================

/**
 * Fetch metrics for a single tweet
 */
export async function fetchTweetMetrics(tweetId: string): Promise<PlatformMetrics | null> {
  try {
    const accessToken = await getValidAccessToken();
    
    console.log('[X Collector] Fetching metrics for tweet:', tweetId);
    
    const url = `${TWEET_ENDPOINT}/${tweetId}?tweet.fields=${TWEET_FIELDS}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    const data: XAPIResponse = await response.json();
    
    if (!response.ok || !data.data) {
      console.error('[X Collector] Failed to fetch metrics:', data.errors);
      return null;
    }
    
    return mapXMetricsToStandard(data.data);
    
  } catch (error) {
    console.error('[X Collector] Error fetching metrics:', error);
    return null;
  }
}

/**
 * Fetch metrics for multiple tweets
 */
export async function fetchMultipleTweetMetrics(
  tweetIds: string[]
): Promise<Map<string, PlatformMetrics>> {
  const results = new Map<string, PlatformMetrics>();
  
  if (tweetIds.length === 0) return results;
  
  try {
    const accessToken = await getValidAccessToken();
    
    // X API allows up to 100 IDs per request
    const batches = chunkArray(tweetIds, 100);
    
    for (const batch of batches) {
      const ids = batch.join(',');
      const url = `${TWEET_ENDPOINT}?ids=${ids}&tweet.fields=${TWEET_FIELDS}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      const data = await response.json();
      
      if (data.data && Array.isArray(data.data)) {
        for (const tweet of data.data) {
          const metrics = mapXMetricsToStandard(tweet);
          if (metrics) {
            results.set(tweet.id, metrics);
          }
        }
      }
    }
    
    console.log('[X Collector] Fetched metrics for', results.size, 'tweets');
    return results;
    
  } catch (error) {
    console.error('[X Collector] Error fetching multiple metrics:', error);
    return results;
  }
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Map X API metrics to our standard format
 */
function mapXMetricsToStandard(tweet: XTweetData): PlatformMetrics {
  const pub: XPublicMetrics = tweet.public_metrics || {
    retweet_count: 0,
    reply_count: 0,
    like_count: 0,
    quote_count: 0,
  };
  const nonPub: XNonPublicMetrics = tweet.non_public_metrics || {};
  
  // Calculate total engagements
  const engagements = (pub.like_count || 0) + 
                      (pub.retweet_count || 0) + 
                      (pub.reply_count || 0) + 
                      (pub.quote_count || 0) +
                      (pub.bookmark_count || 0);
  
  return {
    impressions: pub.impression_count || nonPub.impression_count || 0,
    engagements,
    likes: pub.like_count || 0,
    shares: (pub.retweet_count || 0) + (pub.quote_count || 0),
    comments: pub.reply_count || 0,
    clicks: nonPub.url_link_clicks || 0,
    saves: pub.bookmark_count || 0,
  };
}

/**
 * Split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Get tweet username from URL
 */
export function extractTweetId(url: string): string | null {
  // Handles: https://x.com/user/status/123 or https://twitter.com/user/status/123
  const match = url.match(/(?:x|twitter)\.com\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

