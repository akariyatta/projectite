import nodemailer from "nodemailer";
import { query } from "./db";

// Every email is recorded in email_outbox (admin → อีเมล). It is only really sent when SMTP is configured:
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, MAIL_FROM
// Without SMTP the email is stored with status "logged" so the site keeps working during development.

export const smtpEnabled = () => Boolean(process.env.SMTP_HOST);
export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

let transport;
function transporter() {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

/** Send (or just record) an email. Never throws — a mail problem must not break a booking. */
export async function sendMail(to, subject, html) {
  let status = "logged";
  let error = null;
  if (smtpEnabled()) {
    try {
      await transporter().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, html });
      status = "sent";
    } catch (e) {
      status = "failed";
      error = String(e.message ?? e).slice(0, 500);
      console.error("sendMail failed:", e);
    }
  }
  try {
    await query("INSERT INTO email_outbox (to_email, subject, body_html, status, error) VALUES (?,?,?,?,?)", [to, subject, html, status, error]);
  } catch (e) {
    console.error("email_outbox insert failed:", e);
  }
  return status;
}
