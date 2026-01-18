import { NextResponse } from 'next/server';
import { postTweet } from '@/lib/x/client';
import type { GoToMarketPlan, ChannelPlan } from '@/types/plan';

/**
 * POST /api/execute
 * 
 * Receives a GoToMarketPlan JSON and executes it by posting to the appropriate channels.
 * For MVP: Only handles X (Twitter) channel with immediate execution.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Accept either full plan or just the channels array
    const plan: GoToMarketPlan = body.channels ? body : { channels: body };
    
    console.log('[Executor] Received plan with', plan.channels.length, 'channels');
    
    const results = [];
    
    for (const channelPlan of plan.channels) {
      console.log('[Executor] Processing channel:', channelPlan.channel);
      
      if (channelPlan.channel === 'X') {
        // Execute X (Twitter) posts
        const xResult = await executeXPlan(channelPlan);
        results.push({
          channel: 'X',
          ...xResult,
        });
      } else {
        // Other channels not implemented yet
        results.push({
          channel: channelPlan.channel,
          success: false,
          error: `Channel ${channelPlan.channel} not implemented yet`,
          skipped: true,
        });
      }
    }
    
    const allSuccess = results.every(r => r.success || r.skipped);
    
    return NextResponse.json({
      success: allSuccess,
      message: allSuccess ? 'Plan executed successfully!' : 'Some channels failed',
      results,
    });
    
  } catch (error) {
    console.error('[Executor] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to execute plan' 
      },
      { status: 500 }
    );
  }
}

/**
 * Execute X (Twitter) channel plan
 */
async function executeXPlan(plan: ChannelPlan) {
  const tweets = [];
  
  // Main content
  if (plan.content) {
    tweets.push({
      text: plan.content,
      mediaUrl: plan.description, // description might contain image URL
    });
  }
  
  // Additional steps
  for (const step of plan.steps || []) {
    if (step.content) {
      tweets.push({
        text: step.content,
      });
    }
  }
  
  if (tweets.length === 0) {
    return {
      success: false,
      error: 'No content to post for X channel',
    };
  }
  
  console.log('[Executor] Posting', tweets.length, 'tweets to X');
  
  // For MVP: Just post the first/main tweet
  const mainTweet = tweets[0];
  const result = await postTweet({
    text: mainTweet.text,
    mediaUrl: mainTweet.mediaUrl,
  });
  
  return {
    success: result.success,
    tweetId: result.tweetId,
    tweetUrl: result.tweetUrl,
    error: result.error,
    tweetsPlanned: tweets.length,
    tweetsPosted: result.success ? 1 : 0,
  };
}

