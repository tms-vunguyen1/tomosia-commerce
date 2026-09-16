import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MERCHANT_AUTH_COOKIE } from "@/lib/constants";
import { getSessionUser } from "@/lib/merchant/auth";
import PortalApp from "@/layouts/merchant/shell/PortalApp";

export default async function MerchantPortalPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(MERCHANT_AUTH_COOKIE)?.value;
  const user = token ? await getSessionUser(token) : null;

  // The layout above already redirects when there's no valid session —
  // this only satisfies TypeScript's control-flow narrowing below.
  if (!user) {
    redirect("/merchant/login?next=%2Fmerchant");
  }

  return <PortalApp operator={{ name: user.name, role: "Merchant" }} />;
}
