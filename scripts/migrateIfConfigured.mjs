// Runs `prisma migrate deploy` only when DATABASE_URL is set, so `npm run build`
// stays green for contributors who haven't set up the merchant-portal Postgres yet.
// On Vercel, DATABASE_URL is injected directly (no .env file); dotenv/config is a
// no-op there since it never throws on a missing file.
import "dotenv/config";
import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL not set — skipping prisma migrate deploy");
  process.exit(0);
}

execSync("npx prisma migrate deploy", { stdio: "inherit" });
