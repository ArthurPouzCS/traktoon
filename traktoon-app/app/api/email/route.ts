import { NextResponse } from 'next/server';
import { sendEmail, sendBulkEmail } from '@/lib/email';

/**
 * GET /api/email
 * Check email service status
 */
export async function GET() {
  const configured = !!process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  
  return NextResponse.json({
    success: true,
    configured,
    from,
    message: configured 
      ? 'Email service ready' 
      : 'RESEND_API_KEY not configured',
  });
}

/**
 * POST /api/email
 * Send an email
 * 
 * Body:
 * - to: string | string[] (required)
 * - subject: string (required)
 * - html?: string
 * - text?: string
 * - replyTo?: string
 * - from?: string
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.to) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: to' },
        { status: 400 }
      );
    }
    
    if (!body.subject) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: subject' },
        { status: 400 }
      );
    }
    
    // Check if bulk or single
    const recipients = Array.isArray(body.to) ? body.to : [body.to];
    
    if (recipients.length === 1) {
      // Single email
      const result = await sendEmail({
        to: recipients[0],
        subject: body.subject,
        html: body.html,
        text: body.text,
        replyTo: body.replyTo,
        from: body.from,
        tags: body.tags,
      });
      
      return NextResponse.json({
        success: result.success,
        id: result.id,
        error: result.error,
      });
    } else {
      // Bulk email
      const result = await sendBulkEmail(recipients, {
        subject: body.subject,
        html: body.html,
        text: body.text,
        replyTo: body.replyTo,
        from: body.from,
        tags: body.tags,
      });
      
      return NextResponse.json({
        success: result.success,
        sent: result.sent,
        failed: result.failed,
        message: `Sent ${result.sent}/${recipients.length} emails`,
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
