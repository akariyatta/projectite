import Link from "next/link";
import { PageHead } from "@/components/admin/ui";
import TwoFactorPanel from "@/components/two-factor/TwoFactor";
import { confirmAdminTwoFactor, disableAdminTwoFactor, startAdminTwoFactor } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { twoFactorStatus } from "@/lib/two-factor";

export const metadata = { title: "ความปลอดภัยของฉัน · Hotel Travel Admin" };

export default async function SecurityPage() {
  const admin = await requireAdmin();
  const tfa = await twoFactorStatus("admin", admin.id);

  return (
    <div className="adm-stack" style={{ maxWidth: 760 }}>
      <PageHead
        eyebrow="My account"
        title="ความปลอดภัยของฉัน"
        subtitle={`${admin.name} · ${admin.email}`}
      />
      <TwoFactorPanel
        ui="adm"
        enabled={tfa.enabled}
        backupLeft={tfa.backupLeft}
        start={startAdminTwoFactor}
        confirm={confirmAdminTwoFactor}
        disable={disableAdminTwoFactor}
      />
      <div className="adm-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>รหัสผ่าน</h2>
          <p className="adm-muted" style={{ fontSize: 13.5, marginTop: 4 }}>เปลี่ยนแล้ว เครื่องอื่นที่ล็อกอินค้างไว้จะถูกออกจากระบบ</p>
        </div>
        <Link href="/account/password" className="adm-btn adm-btn-ghost">เปลี่ยนรหัสผ่าน</Link>
      </div>
      <p className="adm-muted" style={{ fontSize: 13 }}>
        ทีมงานคนไหนทำมือถือหายและไม่มีรหัสสำรอง แอดมินคนอื่นปิด 2FA ให้ได้ที่หน้า ผู้ดูแลระบบ → แก้ไขบัญชีนั้น
      </p>
    </div>
  );
}
