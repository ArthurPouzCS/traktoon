/**
 * Email Types
 * Type definitions for email sending and tracking
 */

// ============================================================
// EMAIL CONTENT
// ============================================================

/**
 * Email recipient
 */
export interface EmailRecipient {
  email: string;
  name?: string;
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename: string;
  content: string;      // Base64 encoded content
  contentType?: string; // MIME type
}

/**
 * Email content options
 */
export interface EmailContent {
  to: EmailRecipient | EmailRecipient[] | string | string[];
  subject: string;
  
  // Content (at least one required)
  text?: string;        // Plain text version
  html?: string;        // HTML version
  
  // Optional fields
  from?: string;        // Override default sender
  replyTo?: string;
  cc?: EmailRecipient[] | string[];
  bcc?: EmailRecipient[] | string[];
  attachments?: EmailAttachment[];
  
  // Tracking
  tags?: string[];      // For categorization
  campaign?: string;    // Campaign identifier
}

// ============================================================
// SEND RESULT
// ============================================================

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================
// TEMPLATES
// ============================================================

export type EmailTemplateType = 
  | 'welcome'
  | 'product-launch'
  | 'newsletter'
  | 'promotion'
  | 'follow-up'
  | 'custom';

export interface EmailTemplate {
  type: EmailTemplateType;
  name: string;
  subject: string;
  html: string;
  text?: string;
  variables?: string[]; // e.g., ['firstName', 'productName']
}

// ============================================================
// CAMPAIGN
// ============================================================

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  content: EmailContent;
  recipients: EmailRecipient[];
  scheduledAt?: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  
  // Stats
  stats?: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
  };
}

// ============================================================
// GTM INTEGRATION
// ============================================================

/**
 * Email channel plan for GTM executor
 */
export interface EmailChannelPlan {
  channel: 'Email';
  sequence?: string;
  target?: string;
  
  // Email-specific fields
  recipients: string[];   // List of email addresses
  subject: string;
  content: string;        // Can be text or HTML
  contentType?: 'text' | 'html';
  
  // Optional
  from?: string;
  replyTo?: string;
  template?: EmailTemplateType;
  
  steps?: Array<{
    content: string;
    scheduledAt?: string;
  }>;
}

