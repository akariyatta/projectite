import CartView from "@/components/site/CartView";
import { getCustomer } from "@/lib/customer";

export const metadata = { title: "ตะกร้า · Hotel Travel" };

export default async function CartPage() {
  const user = await getCustomer();
  return (
    <>
      <div className="st-pagehead">
        <div className="st-wrap">
          <div className="st-eyebrow">Your trip</div>
          <h1>ตะกร้าของคุณ</h1>
          <div>รวมที่พัก เที่ยวบิน และตั๋วงานไว้ในการจองเดียว</div>
        </div>
      </div>
      <div className="st-wrap st-pull">
        <CartView signedIn={Boolean(user)} />
      </div>
    </>
  );
}
