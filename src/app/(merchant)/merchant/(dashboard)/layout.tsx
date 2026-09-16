import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MERCHANT_AUTH_COOKIE } from "@/lib/constants";
import { getSessionUser } from "@/lib/merchant/auth";

// The real gate: middleware (src/middleware.ts) only checks that a cookie
// is present and never touches the database; this is the one place that
// validates the session it names is real and unexpired. The only page in
// this group today is /merchant itself, so the return path is fixed here.
export default async function MerchantDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(MERCHANT_AUTH_COOKIE)?.value;
  const user = token ? await getSessionUser(token) : null;

  if (!user) {
    redirect("/merchant/login?next=%2Fmerchant");
  }

  return <>{children}</>;
}
