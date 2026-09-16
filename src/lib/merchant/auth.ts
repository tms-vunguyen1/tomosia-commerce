import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import type { MerchantUser } from "@prisma/client";
import { MERCHANT_SESSION_TTL_MS } from "@/lib/constants";
import { prisma } from "./db";

const BCRYPT_COST = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.merchantSession.create({
    data: {
      id: token,
      userId,
      expiresAt: new Date(Date.now() + MERCHANT_SESSION_TTL_MS),
    },
  });
  return token;
}

export async function getSessionUser(
  token: string,
): Promise<MerchantUser | null> {
  const session = await prisma.merchantSession.findUnique({
    where: { id: token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) {
    return null;
  }
  return session.user;
}

export async function deleteSession(token: string): Promise<void> {
  // deleteMany (not delete) so a missing/already-gone token is a no-op
  // instead of throwing — logout always succeeds, per spec.
  await prisma.merchantSession.deleteMany({ where: { id: token } });
}
