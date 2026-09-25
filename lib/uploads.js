import path from "path";

// Uploaded images live in <project>/uploads (git-ignored) and are served by app/uploads/[name]/route.js.
// Not in /public because Next.js only serves files that existed there at build time.
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");
export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export const TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export const FILE_RE = /^[a-z0-9-]+\.(jpg|png|webp|gif)$/;
export const UPLOAD_URL_RE = /^\/uploads\/[a-z0-9-]+\.(jpg|png|webp|gif)$/;

/** Detect the real image type from the file's first bytes (don't trust the name or browser MIME). */
export function sniffImage(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.toString("ascii", 0, 4) === "GIF8") return "gif";
  return null;
}
