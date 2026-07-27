// ============================================================================
// Shared transactional mailer.
//
// One place to send outbound email (renewal reminders, agent-connect
// notifications). Provider-agnostic: any SMTP endpoint works — Resend, AWS SES,
// Gmail (app password), Mailgun, Postmark, etc. Configure via env:
//
//   MAIL_SMTP_HOST   e.g. smtp.resend.com / email-smtp.<region>.amazonaws.com
//   MAIL_SMTP_PORT   587 (STARTTLS) or 465 (implicit TLS)
//   MAIL_SMTP_USER   SMTP username / access key
//   MAIL_SMTP_PASS   SMTP password / secret
//   MAIL_FROM        "IndSure <hello@indsure.in>"  (verified sender)
//
// Set these in the project-root .env (loaded by loadEnv.ts). Until they exist,
// sendMail() is a no-op that logs a warning — callers must NOT depend on the
// email actually going out (requests/reminders are always persisted first).
// ============================================================================

import nodemailer from "nodemailer";

let cachedTransport: nodemailer.Transporter | null = null;
let cachedKey = "";

function getTransport(): nodemailer.Transporter | null {
  const host = process.env.MAIL_SMTP_HOST;
  const port = process.env.MAIL_SMTP_PORT ? Number(process.env.MAIL_SMTP_PORT) : undefined;
  const user = process.env.MAIL_SMTP_USER;
  const pass = process.env.MAIL_SMTP_PASS;

  if (!host || !port || !user || !pass) return null;

  // Rebuild only if the config changed (cheap memoization).
  const key = `${host}:${port}:${user}`;
  if (cachedTransport && cachedKey === key) return cachedTransport;

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user, pass },
  });
  cachedKey = key;
  return cachedTransport;
}

export function isMailConfigured(): boolean {
  return getTransport() !== null;
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

// Best-effort send. Returns true if handed off to SMTP, false if not configured
// or the send failed. Never throws — callers stay resilient.
export async function sendMail(input: MailInput): Promise<boolean> {
  const transport = getTransport();
  const from = process.env.MAIL_FROM || process.env.MAIL_SMTP_USER;

  if (!transport || !from) {
    console.warn("[mailer] SMTP not configured — skipping email to", input.to);
    return false;
  }

  try {
    await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
    });
    return true;
  } catch (err: any) {
    console.error("[mailer] send failed:", err?.message ?? err);
    return false;
  }
}
