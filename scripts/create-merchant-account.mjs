// Plain Node ESM, no ts-node/tsx — the only way a MerchantUser row gets
// created (no self-service sign-up route exists). Duplicates the bcrypt
// cost constant from src/lib/merchant/auth.ts rather than importing it,
// since this script can't resolve the app's "@/..." TS path aliases.
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcrypt";

const BCRYPT_COST = 12;

const [email, password, name] = process.argv.slice(2);

if (!email || !password || !name) {
  console.error(
    "Usage: node scripts/create-merchant-account.mjs <email> <password> <name>",
  );
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await prisma.merchantUser.create({
    data: { email, passwordHash, name },
  });
  console.log(`Created merchant account ${user.email} (${user.id}).`);
} catch (error) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    console.error(`A merchant account with email "${email}" already exists.`);
    process.exit(1);
  }
  throw error;
} finally {
  await prisma.$disconnect();
}
