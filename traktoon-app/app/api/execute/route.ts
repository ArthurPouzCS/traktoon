import { NextResponse } from 'next/server';
import { postTweet } from '@/lib/x/client';
import { sendEmail, wrapInHtmlTemplate, isConfigured as isEmailConfigured } from '@/lib/email';
import { trackPost } from '@/lib/analytics';
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
      } else if (channelPlan.channel === 'Email') {
        // Execute Email campaign
        const emailResult = await executeEmailPlan(channelPlan);
        results.push({
          channel: 'Email',
          ...emailResult,
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
  
  // Track the post for analytics if successful
  let trackedPostId: string | undefined;
  if (result.success && result.tweetId) {
    try {
      const trackedPost = await trackPost({
        channel: 'X',
        platformPostId: result.tweetId,
        platformUrl: result.tweetUrl || `https://x.com/i/status/${result.tweetId}`,
        content: mainTweet.text,
        target: plan.target || 'General',
        campaign: plan.sequence,
      });
      trackedPostId = trackedPost.id;
      console.log('[Executor] Post tracked for analytics:', trackedPostId);
    } catch (trackError) {
      console.error('[Executor] Failed to track post:', trackError);
      // Don't fail the whole operation if tracking fails
    }
  }
  
  return {
    success: result.success,
    tweetId: result.tweetId,
    tweetUrl: result.tweetUrl,
    trackedPostId,  // Include tracking ID for later analysis
    error: result.error,
    tweetsPlanned: tweets.length,
    tweetsPosted: result.success ? 1 : 0,
  };
}

/**
 * Execute Email channel plan
 */
async function executeEmailPlan(plan: ChannelPlan & { 
  recipients?: string[]; 
  subject?: string;
  contentType?: 'text' | 'html';
}) {
  // Check if email is configured
  if (!isEmailConfigured()) {
    return {
      success: false,
      error: 'Email service not configured. Set RESEND_API_KEY in .env',
    };
  }
  
  // Get recipients
  const recipients = plan.recipients || [];
  
  if (recipients.length === 0) {
    return {
      success: false,
      error: 'No recipients specified for Email channel',
    };
  }
  
  // Get content
  const content = plan.content;
  const subject = plan.subject || plan.sequence || 'Message from Tractoon';
  
  if (!content) {
    return {
      success: false,
      error: 'No content specified for Email channel',
    };
  }
  
  console.log('[Executor] Sending email to', recipients.length, 'recipients');
  
  // Prepare HTML content
  const isHtml = plan.contentType === 'html' || content.includes('<');
  const html = isHtml ? content : wrapInHtmlTemplate(content, subject);
  const text = isHtml ? content.replace(/<[^>]+>/g, '').trim() : content;
  
  // Send to all recipients
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  
  // Sanitize tag (only ASCII letters, numbers, underscores, dashes)
  const sanitizeTag = (tag: string) => tag.replace(/[^a-zA-Z0-9_-]/g, '_');
  
  for (const recipient of recipients) {
    const result = await sendEmail({
      to: recipient,
      subject,
      html,
      text,
      tags: plan.sequence ? [sanitizeTag(plan.sequence)] : undefined,
      campaign: plan.sequence,
    });
    
    if (result.success) {
      sent++;
    } else {
      failed++;
      if (result.error) {
        errors.push(`${recipient}: ${result.error}`);
      }
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Track for analytics if any were sent
  let trackedPostId: string | undefined;
  if (sent > 0) {
    try {
      const trackedPost = await trackPost({
        channel: 'Email',
        platformPostId: `email-${Date.now()}`,
        platformUrl: '',
        content: `${subject}: ${text.substring(0, 100)}...`,
        target: plan.target || 'General',
        campaign: plan.sequence,
      });
      trackedPostId = trackedPost.id;
      console.log('[Executor] Email tracked for analytics:', trackedPostId);
    } catch (trackError) {
      console.error('[Executor] Failed to track email:', trackError);
    }
  }
  
  const allSuccess = failed === 0;
  
  return {
    success: allSuccess,
    trackedPostId,
    emailsSent: sent,
    emailsFailed: failed,
    totalRecipients: recipients.length,
    error: allSuccess ? undefined : `${failed} emails failed: ${errors.slice(0, 3).join('; ')}`,
  };
}

