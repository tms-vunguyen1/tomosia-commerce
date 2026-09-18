import OrderHistory from "@/components/orders/OrderHistory";
import { AUTH_COOKIE } from "@/lib/constants";
import { getCustomerOrders } from "@/lib/shopify";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Your Orders",
};

export default async function AccountOrdersPage() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) {
    redirect("/login");
  }

  const customer = await getCustomerOrders(token, 20).catch(() => null);
  if (!customer) {
    // Expired or revoked token — same "treat as logged out" call /api/customer/me makes.
    redirect("/login");
  }

  return (
    <div className="container py-16">
      <h1 className="mb-8 text-2xl font-semibold text-text-dark dark:text-darkmode-text-dark">
        Your Orders
      </h1>
      <OrderHistory orders={customer.orders} />
    </div>
  );
}
