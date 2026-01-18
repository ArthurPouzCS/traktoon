/**
 * Email Module
 * 
 * Send emails via Resend for GTM campaigns
 * 
 * Usage:
 *   import { sendEmail, sendHtmlEmail } from '@/lib/email';
 */

// Types
export * from './types';

// Client functions
export {
  sendEmail,
  sendBulkEmail,
  sendTextEmail,
  sendHtmlEmail,
  wrapInHtmlTemplate,
  isValidEmail,
  isConfigured,
} from './client';

