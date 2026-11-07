import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export type EmailResult =
  | { status: 'sent' }
  | { status: 'not_configured' }
  | { status: 'failed'; error: string };

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.smtp.configured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
}): Promise<EmailResult> {
  const transport = getTransporter();
  if (!transport) {
    return { status: 'not_configured' };
  }
  try {
    await transport.sendMail({
      from: env.smtp.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
    });
    return { status: 'sent' };
  } catch (error) {
    logger.error({ err: error }, 'Email delivery failed');
    return { status: 'failed', error: 'Email delivery failed' };
  }
}

export function emailConfigured(): boolean {
  return env.smtp.configured;
}
