import { readFile } from "fs/promises";
import path from "path";
import { FILE_RE, TYPES, UPLOAD_DIR } from "@/lib/uploads";

// GET /uploads/<name> — public, so the front site can show uploaded hotel photos too.
export async function GET(_request, { params }) {
  const { name } = await params;
  if (!FILE_RE.test(name)) return new Response("Not found", { status: 404 });
  try {
    const buf = await readFile(path.join(UPLOAD_DIR, name));
    return new Response(buf, {
      headers: {
        "Content-Type": TYPES[name.split(".").pop()],
        "Cache-Control": "public, max-age=31536000, immutable", // names are unique, so safe to cache forever
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
