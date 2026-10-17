import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { query } from "./db";
import { newBackupCodes, newSecret, openSecret, otpauthUri, sealSecret, spendBackupCode, verifyCode } from "./totp";

// Two-factor sign-in (authenticator app) shared by admins and customers.
// Login with 2FA on: correct password → short-lived "pending" cookie → /…/verify asks for the 6-digit code
// (or a one-time backup code) → only then is the real session created.

const KINDS = {
  admin: { table: "admins", cookie: "admin_2fa" },
  customer: { table: "users", cookie: "customer_2fa" },
};
const PENDING_SECONDS = 5 * 60;

const sign = (kind, value) => createHmac("sha256", process.env.SESSION_SECRET).update(`2fa:${kind}:${value}`).digest("hex");

/** Password was right — remember who is half-way through signing in. */
export async function setPending(kind, id) {
  const value = `${id}.${Date.now() + PENDING_SECONDS * 1000}`;
  (await cookies()).set(KINDS[kind].cookie, `${value}.${sign(kind, value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PENDING_SECONDS,
    path: "/",
  });
}

/** Account id waiting for its code, or null (missing / expired / tampered). */
export async function readPending(kind) {
  const raw = (await cookies()).get(KINDS[kind].cookie)?.value;
  if (!raw) return null;
  const [id, exp, sig] = raw.split(".");
  const expected = Buffer.from(sign(kind, `${id}.${exp}`));
  if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), expected)) return null;
  if (Number(exp) < Date.now()) return null;
  return Number(id);
}

export async function clearPending(kind) {
  (await cookies()).delete(KINDS[kind].cookie);
}

async function row(kind, id) {
  const [r] = await query(
    `SELECT id, name, email, session_version, totp_secret, totp_enabled, totp_last_step, backup_codes FROM ${KINDS[kind].table} WHERE id = ?`,
    [id],
  );
  return r ?? null;
}

const backupLeft = (r) => {
  try { return JSON.parse(r.backup_codes || "[]").length; } catch { return 0; }
};

export async function twoFactorStatus(kind, id) {
  const r = await row(kind, id);
  return { enabled: Boolean(r?.totp_enabled), backupLeft: r ? backupLeft(r) : 0 };
}

/** Step 1 of setup: a fresh secret (kept until confirmed) + QR code for the app. */
export async function beginSetup(kind, id) {
  const r = await row(kind, id);
  if (!r || r.totp_enabled) return null;
  const secret = newSecret();
  await query(`UPDATE ${KINDS[kind].table} SET totp_secret = ?, totp_last_step = NULL WHERE id = ? AND totp_enabled = 0`, [sealSecret(secret), id]);
  const uri = otpauthUri(r.email, secret);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220, color: { dark: "#14213d", light: "#ffffff" } });
  return { qr, secret: secret.match(/.{1,4}/g).join(" ") };
}

/**
 * Step 2 of setup: the first code from the app proves it was scanned correctly.
 * Returns { codes, version } (backup codes to show once + the new session version) or null for a wrong code.
 * Other devices are signed out, so they must sign in again with 2FA.
 */
export async function confirmSetup(kind, id, code) {
  const r = await row(kind, id);
  if (!r || r.totp_enabled) return null;
  const secret = openSecret(r.totp_secret);
  const step = secret && verifyCode(secret, code);
  if (step == null) return null;
  const { codes, hashes } = newBackupCodes();
  await query(
    `UPDATE ${KINDS[kind].table} SET totp_enabled = 1, totp_last_step = ?, backup_codes = ?, session_version = session_version + 1 WHERE id = ?`,
    [step, JSON.stringify(hashes), id],
  );
  return { codes, version: r.session_version + 1 };
}

/**
 * Checks a sign-in code: a 6-digit app code (not reused) or an unused backup code (then crossed off).
 * Returns { ok, usedBackup, backupLeft }.
 */
export async function checkCode(kind, id, code) {
  const r = await row(kind, id);
  if (!r?.totp_enabled) return { ok: false };
  const secret = openSecret(r.totp_secret);
  const step = secret && verifyCode(secret, code, r.totp_last_step);
  if (step != null) {
    await query(`UPDATE ${KINDS[kind].table} SET totp_last_step = ? WHERE id = ?`, [step, id]);
    return { ok: true, usedBackup: false, backupLeft: backupLeft(r) };
  }
  const remaining = spendBackupCode(r.backup_codes, code);
  if (remaining) {
    await query(`UPDATE ${KINDS[kind].table} SET backup_codes = ? WHERE id = ?`, [JSON.stringify(remaining), id]);
    return { ok: true, usedBackup: true, backupLeft: remaining.length };
  }
  return { ok: false };
}

/** Turns 2FA off (by the owner, or by an admin for someone who lost their phone). */
export async function disableTwoFactor(kind, id) {
  await query(
    `UPDATE ${KINDS[kind].table} SET totp_enabled = 0, totp_secret = NULL, totp_last_step = NULL, backup_codes = NULL WHERE id = ?`,
    [id],
  );
}
