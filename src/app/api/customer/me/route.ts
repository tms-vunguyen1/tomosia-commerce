import { AUTH_COOKIE } from "@/lib/constants";
import { getUserDetails } from "@/lib/shopify";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// The access token is httpOnly, so the client cannot read it or call Shopify
// itself. It asks here instead and only ever receives the profile.
export async function GET() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ customer: null });
  }

  try {
    const { customer } = await getUserDetails(token);
    return NextResponse.json({ customer: customer ?? null });
  } catch (error) {
    // Expired or revoked token — treat as logged out rather than erroring.
    console.error("Error fetching customer details:", error);
    return NextResponse.json({ customer: null });
  }
}
