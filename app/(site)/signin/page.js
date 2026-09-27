import { redirect } from "next/navigation";
import AuthForm from "@/components/site/AuthForm";
import { getCustomer } from "@/lib/customer";
import { safeNext } from "@/lib/passwords";

export const metadata = { title: "เข้าสู่ระบบ · Hotel Travel" };

export default async function SignIn({ searchParams }) {
  const next = safeNext((await searchParams).next, "/bookings");
  if (await getCustomer()) redirect(next);
  return (
    <div className="st-wrap st-auth">
      <AuthForm mode="signin" next={next} />
    </div>
  );
}
