import { AUTH_COOKIE, AUTH_COOKIE_OPTIONS } from "@/lib/constants";
import { createCustomer, getCustomerAccessToken } from "@/lib/shopify";
import { attachCustomerToCart } from "@/lib/utils/cartActions";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const input = await req.json();
    const { customer, customerCreateErrors } = await createCustomer(input);
    const { token } = await getCustomerAccessToken(input);

    if (customerCreateErrors.length > 0) {
      return NextResponse.json(
        { errors: customerCreateErrors },
        { status: 400 },
      );
    }
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE, token, AUTH_COOKIE_OPTIONS);

    // Carry an existing guest cart over to the account they just created.
    await attachCustomerToCart();

    // The token stays server-side — the client only ever sees the profile.
    return NextResponse.json(customer);
  } catch (error: any) {
    const { message, status } = error.error;
    return NextResponse.json(
      { errors: [{ code: "INTERNAL_ERROR", message }] },
      { status },
    );
  }
}
