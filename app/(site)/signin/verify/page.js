import Link from "next/link";
import { redirect } from "next/navigation";
import { VerifyForm } from "@/components/two-factor/TwoFactor";
import { getCustomer } from "@/lib/customer";
import { safeNext } from "@/lib/passwords";
import { verifyCustomerLogin } from "@/lib/site-actions";
import { readPending } from "@/lib/two-factor";

export const metadata = { title: "ยืนยันตัวตน · Hotel Travel" };

// Second sign-in step for customers with 2FA on (the password was already checked on /signin).
export default async function VerifySignIn({ searchParams }) {
  const next = safeNext((await searchParams).next, "/");
  if (await getCustomer()) redirect(next);
  if (!(await readPending("customer"))) redirect(`/signin?next=${encodeURIComponent(next)}`);

  return (
    <div className="st-wrap st-auth">
      <div className="st-card">
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36 }}>🛡️</div>
          <h1>ยืนยันตัวตน 2 ขั้น</h1>
          <p className="st-muted" style={{ fontSize: 14 }}>เปิดแอป Authenticator ในมือถือ แล้วใส่รหัส 6 หลักของ Hotel Travel</p>
        </div>
        <VerifyForm action={verifyCustomerLogin} ui="st" next={next} />
        <p className="st-muted" style={{ textAlign: "center", fontSize: 13 }}>
          ทำมือถือหายและไม่มีรหัสสำรอง? ติดต่อเจ้าหน้าที่เพื่อปิดการยืนยัน 2 ขั้น · <Link href={`/signin?next=${encodeURIComponent(next)}`} className="st-link">ใช้บัญชีอื่น</Link>
        </p>
      </div>
    </div>
  );
}
