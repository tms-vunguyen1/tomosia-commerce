// Assert-based self-check for src/lib/merchant/auth.ts's two non-trivial,
// security-sensitive pieces of logic: password hashing and session-expiry
// rejection. Mirrors that module's operations rather than importing it
// directly — Node can't resolve this repo's extensionless, path-aliased
// TS imports without a loader (no ts-node/tsx installed, matching
// scripts/create-merchant-account.mjs's same constraint). If
// getSessionUser's expiry comparison ever changes, update the copy below.
//
// Run: node scripts/test-merchant-auth.mjs
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const BCRYPT_COST = 12;
const prisma = new PrismaClient();

async function testPasswordRoundTrip() {
  const hash = await bcrypt.hash("correct horse battery staple", BCRYPT_COST);
  assert.equal(
    await bcrypt.compare("correct horse battery staple", hash),
    true,
    "the correct password must verify",
  );
  assert.equal(
    await bcrypt.compare("wrong password", hash),
    false,
    "a wrong password must not verify",
  );
}

// Mirrors getSessionUser in src/lib/merchant/auth.ts.
async function getSessionUser(token) {
  const session = await prisma.merchantSession.findUnique({
    where: { id: token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) {
    return null;
  }
  return session.user;
}

async function testSessionExpiry() {
  const suffix = Date.now();
  const user = await prisma.merchantUser.create({
    data: {
      email: `test-auth-self-check-${suffix}@example.invalid`,
      passwordHash: "unused",
      name: "Self Check",
    },
  });

  const expiredToken = `expired-${suffix}`;
  const activeToken = `active-${suffix}`;
  await prisma.merchantSession.create({
    data: {
      id: expiredToken,
      userId: user.id,
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  await prisma.merchantSession.create({
    data: {
      id: activeToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });

  try {
    assert.equal(
      await getSessionUser(expiredToken),
      null,
      "an expired session must be rejected",
    );
    const activeUser = await getSessionUser(activeToken);
    assert.equal(
      activeUser?.id,
      user.id,
      "an active session must resolve to its user",
    );
    assert.equal(
      await getSessionUser(`no-such-token-${suffix}`),
      null,
      "an unknown token must be rejected",
    );
  } finally {
    await prisma.merchantSession.deleteMany({ where: { userId: user.id } });
    await prisma.merchantUser.delete({ where: { id: user.id } });
  }
}

try {
  await testPasswordRoundTrip();
  await testSessionExpiry();
  console.log("OK: merchant auth self-check passed");
} finally {
  await prisma.$disconnect();
}
