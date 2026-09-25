import Link from "next/link";
import "@/components/admin/admin.css";
import { adminFonts } from "@/components/admin/fonts";
import Nav from "@/components/admin/Nav";
import { logout } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Admin · Hotel Travel" };

export default async function AdminLayout({ children }) {
  const admin = await requireAdmin();

  return (
    <div className={`adm-root ${adminFonts}`}>
      <aside className="adm-side">
        <div className="adm-brand">
          <div className="adm-brand-mark">✦ ✦ ✦</div>
          <div className="adm-brand-name">Hotel Travel</div>
          <div className="adm-brand-sub">Admin Console</div>
        </div>
        <Nav />
        <div className="adm-side-foot">
          <div className="adm-avatar">{admin.name.charAt(0).toUpperCase()}</div>
          <Link href={`/admin/admins/${admin.id}`} className="adm-who" title="แก้ไขบัญชี / เปลี่ยนรหัสผ่าน">
            <div>{admin.name}</div>
            <div className="adm-email">{admin.email}</div>
          </Link>
          <form action={logout}>
            <button className="adm-logout">ออก</button>
          </form>
        </div>
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  );
}
