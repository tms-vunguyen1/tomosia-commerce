import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { MERCHANT_AUTH_COOKIE, MERCHANT_AUTH_COOKIE_OPTIONS } from "@/lib/constants";
import { createSession, verifyPassword } from "@/lib/merchant/auth";
import { prisma } from "@/lib/merchant/db";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const user = await prisma.merchantUser.findUnique({ where: { email } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;

  // Same generic error for "no such email" and "wrong password" — telling
  // them apart lets an attacker enumerate which emails have accounts.
  if (!user || !ok) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  const token = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(MERCHANT_AUTH_COOKIE, token, MERCHANT_AUTH_COOKIE_OPTIONS);

  return NextResponse.json({ name: user.name });
}
