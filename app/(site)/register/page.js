import { redirect } from "next/navigation";
import AuthForm from "@/components/site/AuthForm";
import { getCustomer } from "@/lib/customer";
import { safeNext } from "@/lib/passwords";

export const metadata = { title: "สมัครสมาชิก · Hotel Travel" };

export default async function Register({ searchParams }) {
  const next = safeNext((await searchParams).next, "/");
  if (await getCustomer()) redirect(next);
  return (
    <div className="st-wrap st-auth">
      <AuthForm mode="register" next={next} />
    </div>
  );
}
