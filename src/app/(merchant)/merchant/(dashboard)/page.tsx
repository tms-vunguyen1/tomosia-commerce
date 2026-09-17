import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MERCHANT_AUTH_COOKIE } from "@/lib/constants";
import { getSessionUser } from "@/lib/merchant/auth";
import PortalApp from "@/layouts/merchant/shell/PortalApp";
import type {
  AlertsResponse,
  ListingDetails,
  OverviewResponse,
  PricingContext,
} from "@/layouts/merchant/lib/types";
import { merchantAssistantUrl, merchantInternalHeaders } from "@/lib/merchant-assistant/service";

async function fetchAgent<T>(path: string): Promise<T> {
  const response = await fetch(merchantAssistantUrl(path), {
    headers: merchantInternalHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`merchant agent ${path} returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export default async function MerchantPortalPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(MERCHANT_AUTH_COOKIE)?.value;
  const user = token ? await getSessionUser(token) : null;

  // The layout above already redirects when there's no valid session —
  // this only satisfies TypeScript's control-flow narrowing below.
  if (!user) {
    redirect("/merchant/login?next=%2Fmerchant");
  }

  let overview: OverviewResponse;
  let listings: ListingDetails[];
  let pricing: Record<string, PricingContext>;
  let alerts: AlertsResponse;
  try {
    const [overviewData, listingsData, alertsData] = await Promise.all([
      fetchAgent<OverviewResponse>("/api/overview"),
      fetchAgent<{ listings: ListingDetails[]; pricing: Record<string, PricingContext> }>(
        "/api/portal/listings",
      ),
      fetchAgent<AlertsResponse>("/api/portal/alerts"),
    ]);
    overview = overviewData;
    listings = listingsData.listings;
    pricing = listingsData.pricing;
    alerts = alertsData;
  } catch {
    // The dashboard reads real Shopify data through merchant-agent now — with no
    // fixture to fall back to, an unreachable agent is a real outage, shown as one.
    return (
      <div className="flex h-dvh items-center justify-center bg-(--ground) p-6 text-center text-(--ink)">
        <div>
          <h1 className="text-lg font-semibold">The merchant assistant is unavailable</h1>
          <p className="mt-2 text-(--ink-soft)">
            Check that merchant-agent is running (MERCHANT_ASSISTANT_API_URL), then reload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PortalApp
      operator={{ name: user.name, role: "Merchant" }}
      overview={overview}
      listings={listings}
      pricing={pricing}
      alerts={alerts}
    />
  );
}
