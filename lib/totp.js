import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

// Time-based one-time passwords (RFC 6238) — the 6-digit codes shown by Google / Microsoft Authenticator.
// Standard settings every authenticator app understands: SHA-1, 6 digits, 30-second steps.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DRIFT_STEPS = 1; // accept the previous / next code too, for phones whose clock is a little off

export function base32Encode(buf) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of str.replace(/[\s=]/g, "").toUpperCase()) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("invalid base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newSecret = () => base32Encode(randomBytes(20));
export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

/** The 6-digit code for one 30-second step. */
export function codeAt(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1] & 15;
  const bin = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(bin).padStart(6, "0");
}

/**
 * Checks a code. Returns the matched step, or null.
 * `lastStep` = the step used at the previous login, so the same code can't be replayed.
 */
export function verifyCode(secret, code, lastStep = null) {
  const clean = String(code ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const now = currentStep();
  for (let s = now - DRIFT_STEPS; s <= now + DRIFT_STEPS; s++) {
    if (lastStep != null && s <= Number(lastStep)) continue;
    if (timingSafeEqual(Buffer.from(codeAt(secret, s)), Buffer.from(clean))) return s;
  }
  return null;
}

/** otpauth:// link that authenticator apps read from the QR code. */
export function otpauthUri(account, secret, issuer = "Hotel Travel") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

// ---------- Secret storage: AES-256-GCM, key derived from SESSION_SECRET ----------
// (changing SESSION_SECRET makes stored secrets unreadable → those accounts must set up 2FA again)

const key = () => createHash("sha256").update(`totp:${process.env.SESSION_SECRET}`).digest();

export function sealSecret(secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function openSecret(sealed) {
  try {
    const [v, iv, tag, data] = String(sealed ?? "").split(".");
    if (v !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ---------- Backup codes: shown once, stored as SHA-256 hashes ----------

const hashBackup = (code) => createHash("sha256").update(code.replace(/[\s-]/g, "").toLowerCase()).digest("hex");

/** 10 codes like "k4xq-9mzt" → { codes (show once), hashes (store) } */
export function newBackupCodes(n = 10) {
  const codes = Array.from({ length: n }, () => {
    const raw = base32Encode(randomBytes(5)).toLowerCase(); // 8 chars
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  });
  return { codes, hashes: codes.map(hashBackup) };
}

/** If `code` is one of the unused backup codes, returns the remaining hashes; otherwise null. */
export function spendBackupCode(hashesJson, code) {
  const clean = String(code ?? "").replace(/[\s-]/g, "").toLowerCase();
  if (!/^[a-z2-7]{8}$/.test(clean)) return null;
  let hashes;
  try { hashes = JSON.parse(hashesJson || "[]"); } catch { return null; }
  const h = hashBackup(clean);
  const i = hashes.indexOf(h);
  if (i < 0) return null;
  return hashes.filter((_, j) => j !== i);
}
