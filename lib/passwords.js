/** Password rules shared by admins and customers. Returns a Thai error message, or null if OK. */
export function passwordProblem(password, email) {
  if (password.length < 8) return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "ต้องมีทั้งตัวอักษรภาษาอังกฤษและตัวเลข";
  const name = String(email ?? "").split("@")[0].toLowerCase();
  if (name.length >= 3 && password.toLowerCase().includes(name)) return "ห้ามมีชื่อผู้ใช้อยู่ในรหัสผ่าน";
  return null;
}

/** Only allow redirects back into this site (blocks "//evil.com" and absolute URLs). */
export const safeNext = (next, fallback = "/") =>
  typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
