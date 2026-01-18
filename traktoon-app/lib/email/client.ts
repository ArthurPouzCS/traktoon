/**
 * Email Client
 * Handles sending emails via Resend
 */

import { Resend } from 'resend';
import type { EmailContent, EmailSendResult, EmailRecipient } from './types';

// ============================================================
// CONFIGURATION
// ============================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEFAULT_FROM = process.env.EMAIL_FROM || 'Tractoon <onboarding@resend.dev>';

// Initialize Resend client
let resendClient: Resend | null = null;

function getClient(): Resend {
  if (!resendClient) {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resendClient = new Resend(RESEND_API_KEY);
  }
  return resendClient;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Normalize recipients to string array
 */
function normalizeRecipients(
  recipients: EmailRecipient | EmailRecipient[] | string | string[]
): string[] {
  if (typeof recipients === 'string') {
    return [recipients];
  }
  
  if (Array.isArray(recipients)) {
    return recipients.map(r => {
      if (typeof r === 'string') return r;
      return r.name ? `${r.name} <${r.email}>` : r.email;
    });
  }
  
  // Single EmailRecipient object
  return [recipients.name ? `${recipients.name} <${recipients.email}>` : recipients.email];
}

// ============================================================
// SEND FUNCTIONS
// ============================================================

/**
 * Send a single email
 */
export async function sendEmail(content: EmailContent): Promise<EmailSendResult> {
  try {
    const client = getClient();
    
    // Prepare recipients
    const to = normalizeRecipients(content.to);
    
    console.log('[Email Client] Sending email to:', to);
    console.log('[Email Client] Subject:', content.subject);
    
    // Build email payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emailPayload: any = {
      from: content.from || DEFAULT_FROM,
      to,
      subject: content.subject,
      html: content.html || content.text || '',
    };
    
    // Add text version if provided
    if (content.text) {
      emailPayload.text = content.text;
    }
    
    // Add optional fields
    if (content.replyTo) {
      emailPayload.replyTo = content.replyTo;
    }
    if (content.cc) {
      emailPayload.cc = normalizeRecipients(content.cc);
    }
    if (content.bcc) {
      emailPayload.bcc = normalizeRecipients(content.bcc);
    }
    if (content.tags && content.tags.length > 0) {
      emailPayload.tags = content.tags.map(tag => ({ name: tag, value: 'true' }));
    }
    
    const { data, error } = await client.emails.send(emailPayload);
    
    if (error) {
      console.error('[Email Client] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
    
    console.log('[Email Client] Email sent successfully! ID:', data?.id);
    
    return {
      success: true,
      messageId: data?.id,
    };
    
  } catch (error) {
    console.error('[Email Client] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send email to multiple recipients (batch)
 */
export async function sendBulkEmail(
  content: Omit<EmailContent, 'to'>,
  recipients: (EmailRecipient | string)[]
): Promise<{ total: number; sent: number; failed: number; results: EmailSendResult[] }> {
  const results: EmailSendResult[] = [];
  let sent = 0;
  let failed = 0;
  
  // Send emails one by one with small delay to avoid rate limiting
  for (const recipient of recipients) {
    const result = await sendEmail({
      ...content,
      to: recipient,
    });
    
    results.push(result);
    
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
    
    // Small delay between emails
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`[Email Client] Bulk send complete: ${sent}/${recipients.length} successful`);
  
  return {
    total: recipients.length,
    sent,
    failed,
    results,
  };
}

/**
 * Send a simple text email
 */
export async function sendTextEmail(
  to: string | string[],
  subject: string,
  text: string
): Promise<EmailSendResult> {
  return sendEmail({
    to,
    subject,
    text,
  });
}

/**
 * Send an HTML email
 */
export async function sendHtmlEmail(
  to: string | string[],
  subject: string,
  html: string,
  text?: string
): Promise<EmailSendResult> {
  return sendEmail({
    to,
    subject,
    html,
    text: text || stripHtml(html),
  });
}

// ============================================================
// TEMPLATES
// ============================================================

/**
 * Simple HTML wrapper for plain content
 */
export function wrapInHtmlTemplate(content: string, title?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Email'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      border-bottom: 2px solid #007bff;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .content {
      padding: 20px 0;
    }
    .footer {
      border-top: 1px solid #eee;
      padding-top: 20px;
      margin-top: 20px;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <strong>Tractoon</strong>
  </div>
  <div class="content">
    ${content.replace(/\n/g, '<br>')}
  </div>
  <div class="footer">
    Sent with ❤️ by Tractoon
  </div>
</body>
</html>
  `.trim();
}

/**
 * Strip HTML tags for plain text version
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

// ============================================================
// VALIDATION
// ============================================================

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if email client is configured
 */
export function isConfigured(): boolean {
  return !!RESEND_API_KEY;
}

