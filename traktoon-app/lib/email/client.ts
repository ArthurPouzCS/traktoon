/**
 * Email Client using Resend
 * For transactional emails and testing
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailContent {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  tags?: { name: string; value: string }[];
}

export interface EmailSendResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Send a single email via Resend
 */
export async function sendEmail(content: EmailContent): Promise<EmailSendResult> {
  const from = content.from || process.env.EMAIL_FROM || 'onboarding@resend.dev';
  
  if (!process.env.RESEND_API_KEY) {
    console.error('[Email] RESEND_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
  }
  
  try {
    console.log('[Email] Sending to:', content.to);
    
    const emailOptions: {
      from: string;
      to: string[];
      subject: string;
      html?: string;
      text?: string;
      replyTo?: string;
      cc?: string[];
      bcc?: string[];
      tags?: { name: string; value: string }[];
    } = {
      from,
      to: Array.isArray(content.to) ? content.to : [content.to],
      subject: content.subject,
    };
    
    if (content.html) {
      emailOptions.html = content.html;
    }
    
    if (content.text) {
      emailOptions.text = content.text;
    } else if (!content.html) {
      emailOptions.text = 'No content';
    }
    
    if (content.replyTo) {
      emailOptions.replyTo = content.replyTo;
    }
    
    if (content.cc) {
      emailOptions.cc = content.cc;
    }
    
    if (content.bcc) {
      emailOptions.bcc = content.bcc;
    }
    
    if (content.tags) {
      emailOptions.tags = content.tags;
    }
    
    const { data, error } = await resend.emails.send(emailOptions as Parameters<typeof resend.emails.send>[0]);
    
    if (error) {
      console.error('[Email] Resend error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[Email] Sent successfully, ID:', data?.id);
    return { success: true, id: data?.id };
    
  } catch (err) {
    console.error('[Email] Exception:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}

/**
 * Send bulk emails (one by one for now)
 */
export async function sendBulkEmail(
  recipients: string[],
  content: Omit<EmailContent, 'to'>
): Promise<{ success: boolean; sent: number; failed: number; results: EmailSendResult[] }> {
  const results: EmailSendResult[] = [];
  let sent = 0;
  let failed = 0;
  
  for (const to of recipients) {
    const result = await sendEmail({ ...content, to });
    results.push(result);
    if (result.success) sent++;
    else failed++;
  }
  
  return {
    success: failed === 0,
    sent,
    failed,
    results,
  };
}

export default { sendEmail, sendBulkEmail };
