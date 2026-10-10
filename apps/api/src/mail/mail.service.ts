import { Injectable, Logger } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";

export interface MailMessage { to: string; subject: string; text: string; html: string }

/**
 * Sends through SMTP when SMTP_HOST is set (Resend, SES, Gmail, MailHog all speak SMTP).
 * Without it, messages are logged and marked sent, so dev and CI run without a mail server.
 */
@Injectable()
export class MailService {
  private log = new Logger("mail");
  private transport: Transporter | null = null;
  readonly from = process.env.MAIL_FROM ?? "JEMCO NCR <ncr@jemco.local>";

  constructor() {
    if (process.env.SMTP_HOST) {
      this.transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
        tls: process.env.SMTP_INSECURE === "true" ? { rejectUnauthorized: false } : undefined,
      });
      this.log.log(`SMTP ${process.env.SMTP_HOST}:${process.env.SMTP_PORT ?? 587}`);
    } else {
      this.log.warn("SMTP_HOST not set: emails are logged, not sent");
    }
  }

  async send(m: MailMessage): Promise<void> {
    if (!this.transport) { this.log.log(`[dry-run] to=${m.to} subject=${m.subject}`); return; }
    await this.transport.sendMail({ from: this.from, to: m.to, subject: m.subject, text: m.text, html: m.html });
  }
}
