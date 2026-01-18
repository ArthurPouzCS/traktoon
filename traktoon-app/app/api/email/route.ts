import { NextResponse } from 'next/server';
import {
  sendEmail,
  sendBulkEmail,
  sendHtmlEmail,
  wrapInHtmlTemplate,
  isValidEmail,
  isConfigured,
  type EmailContent,
} from '@/lib/email';

/**
 * GET /api/email
 * 
 * Check if email service is configured
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    configured: isConfigured(),
    message: isConfigured() 
      ? 'Email service is ready' 
      : 'RESEND_API_KEY not configured',
  });
}

/**
 * POST /api/email
 * 
 * Send an email
 * 
 * Body:
 *   - to: string | string[] (required)
 *   - subject: string (required)
 *   - content: string (required) - text or HTML
 *   - contentType: 'text' | 'html' (default: 'text')
 *   - from?: string
 *   - replyTo?: string
 *   - campaign?: string
 */
export async function POST(request: Request) {
  try {
    // Check if configured
    if (!isConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Email service not configured. Set RESEND_API_KEY.' },
        { status: 503 }
      );
    }
    
    const body = await request.json();
    
    const { to, subject, content, contentType, from, replyTo, campaign } = body;
    
    // Validation
    if (!to) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: to' },
        { status: 400 }
      );
    }
    
    if (!subject) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: subject' },
        { status: 400 }
      );
    }
    
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: content' },
        { status: 400 }
      );
    }
    
    // Validate email addresses
    const recipients = Array.isArray(to) ? to : [to];
    const invalidEmails = recipients.filter(email => !isValidEmail(email));
    
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { success: false, error: `Invalid email addresses: ${invalidEmails.join(', ')}` },
        { status: 400 }
      );
    }
    
    console.log('[Email API] Sending email to', recipients.length, 'recipients');
    
    // Prepare email content
    const isHtml = contentType === 'html' || content.includes('<');
    
    const emailContent: EmailContent = {
      to: recipients,
      subject,
      from,
      replyTo,
      tags: campaign ? [campaign] : undefined,
      campaign,
    };
    
    if (isHtml) {
      emailContent.html = content;
      // Auto-generate plain text version
      emailContent.text = content.replace(/<[^>]+>/g, '').trim();
    } else {
      // Wrap plain text in nice HTML template
      emailContent.html = wrapInHtmlTemplate(content, subject);
      emailContent.text = content;
    }
    
    // Send email(s)
    let result;
    
    if (recipients.length === 1) {
      // Single recipient
      result = await sendEmail(emailContent);
      
      return NextResponse.json({
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      });
    } else {
      // Multiple recipients - send individually
      const { to: _to, ...contentWithoutTo } = emailContent;
      const bulkResult = await sendBulkEmail(
        contentWithoutTo,
        recipients
      );
      
      return NextResponse.json({
        success: bulkResult.failed === 0,
        total: bulkResult.total,
        sent: bulkResult.sent,
        failed: bulkResult.failed,
        message: `Sent ${bulkResult.sent}/${bulkResult.total} emails`,
      });
    }
    
  } catch (error) {
    console.error('[Email API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    );
  }
}

