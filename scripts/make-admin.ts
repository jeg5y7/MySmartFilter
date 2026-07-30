/**
 * Grant admin (order-queue) access to a user by email.
 * Usage: npx tsx scripts/make-admin.ts you@example.com
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/make-admin.ts <email>");
    process.exit(1);
  }

  const user = await db.user.update({
    where: { email },
    data: { isAdmin: true },
  });

  console.log(`✓ ${user.email} is now an admin (id ${user.id})`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
