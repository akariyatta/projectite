import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getAdmin } from "@/lib/auth";
import { MAX_BYTES, sniffImage, UPLOAD_DIR } from "@/lib/uploads";

// POST /admin/upload (multipart, field "file") → { url: "/uploads/<name>" }
export async function POST(request) {
  if (!(await getAdmin())) return Response.json({ error: "กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });

  const file = (await request.formData()).get("file");
  if (!file || typeof file === "string") return Response.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "ไฟล์ใหญ่เกิน 5 MB" }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniffImage(buf);
  if (!ext) return Response.json({ error: "รองรับเฉพาะรูป JPG, PNG, WebP หรือ GIF" }, { status: 415 });

  const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), buf);
  return Response.json({ url: `/uploads/${name}` });
}
