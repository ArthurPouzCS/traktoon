/**
 * X (Twitter) API Client
 * Handles posting tweets with text and media
 */

import { getValidAccessToken } from './token-manager';

const TWEET_ENDPOINT = 'https://api.twitter.com/2/tweets';
const MEDIA_UPLOAD_ENDPOINT = 'https://upload.twitter.com/1.1/media/upload.json';

interface TweetOptions {
  text: string;
  mediaUrl?: string; // URL of image to upload
}

interface TweetResult {
  success: boolean;
  tweetId?: string;
  tweetUrl?: string;
  error?: string;
}

/**
 * Post a tweet with optional media
 */
export async function postTweet(options: TweetOptions): Promise<TweetResult> {
  try {
    const accessToken = await getValidAccessToken();
    
    let mediaId: string | undefined;
    
    // If there's an image URL, upload it first
    if (options.mediaUrl) {
      console.log('[X Client] Uploading media from URL:', options.mediaUrl);
      mediaId = await uploadMediaFromUrl(options.mediaUrl, accessToken);
    }
    
    // Post the tweet
    console.log('[X Client] Posting tweet:', options.text.substring(0, 50) + '...');
    
    const tweetBody: Record<string, unknown> = { text: options.text };
    if (mediaId) {
      tweetBody.media = { media_ids: [mediaId] };
    }
    
    const response = await fetch(TWEET_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetBody),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('[X Client] Tweet failed:', data);
      return {
        success: false,
        error: data.detail || data.title || 'Failed to post tweet',
      };
    }
    
    const tweetId = data.data.id;
    console.log('[X Client] Tweet posted successfully! ID:', tweetId);
    
    return {
      success: true,
      tweetId,
      tweetUrl: `https://x.com/i/status/${tweetId}`,
    };
  } catch (error) {
    console.error('[X Client] Error posting tweet:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Upload media from a URL
 * Note: X API v1.1 media upload requires OAuth 1.0a or special handling
 * For MVP, we'll use a simpler approach with just text tweets
 */
async function uploadMediaFromUrl(imageUrl: string, accessToken: string): Promise<string | undefined> {
  try {
    // For MVP: Skip media upload, just return undefined
    // Full implementation would:
    // 1. Download the image from URL
    // 2. Convert to base64
    // 3. Upload to X media endpoint
    // 4. Return media_id
    
    console.log('[X Client] Media upload not yet implemented for MVP');
    console.log('[X Client] Image URL was:', imageUrl);
    
    // TODO: Implement media upload when needed
    return undefined;
  } catch (error) {
    console.error('[X Client] Media upload failed:', error);
    return undefined;
  }
}

/**
 * Post multiple tweets (for a campaign)
 */
export async function postMultipleTweets(tweets: TweetOptions[]): Promise<TweetResult[]> {
  const results: TweetResult[] = [];
  
  for (const tweet of tweets) {
    const result = await postTweet(tweet);
    results.push(result);
    
    // Small delay between tweets to avoid rate limiting
    if (tweets.indexOf(tweet) < tweets.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

