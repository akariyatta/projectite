import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "./db";

const COOKIE = "admin_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function sign(value) {
  return createHmac("sha256", process.env.SESSION_SECRET).update(value).digest("hex");
}

// Cookie = "<adminId>.<sessionVersion>.<expiresAt>.<hmac>"
// Bumping admins.session_version (on password change) logs that admin out everywhere.
export async function createSession(adminId, version) {
  const value = `${adminId}.${version}.${Date.now() + MAX_AGE * 1000}`;
  (await cookies()).set(COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** Returns the logged-in admin ({ id, name, email, must_change_password, session_version }) or null. */
export async function getAdmin() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, version, exp, sig] = raw.split(".");
  const expected = Buffer.from(sign(`${id}.${version}.${exp}`));
  if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), expected)) return null;
  if (Number(exp) < Date.now()) return null;
  const [admin] = await query(
    "SELECT id, name, email, must_change_password, session_version FROM admins WHERE id = ? AND status = 'active'",
    [Number(id)],
  );
  if (!admin || admin.session_version !== Number(version)) return null;
  return admin;
}

/**
 * Call at the top of every admin page and server action.
 * Admins still on a temporary password are sent to /account/password first.
 */
export async function requireAdmin({ allowTempPassword = false } = {}) {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  if (admin.must_change_password && !allowTempPassword) redirect("/account/password");
  return admin;
}
