/**
 * Register a smart-home OAuth client (Google Home / Alexa / SmartThings).
 * Prints the client_id and client_secret ONCE — paste them into the
 * platform's account-linking config; only a hash is stored here.
 *
 * Usage:
 *   npx tsx scripts/create-oauth-client.ts "Google Home" https://oauth-redirect.googleusercontent.com/r/PROJECT_ID
 *   (additional redirect URIs as extra arguments)
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "crypto";

const db = new PrismaClient();

async function main() {
  const [name, ...redirectUris] = process.argv.slice(2);
  if (!name || redirectUris.length === 0) {
    console.error(
      'Usage: npx tsx scripts/create-oauth-client.ts "<name>" <redirect-uri> [more-uris...]'
    );
    process.exit(1);
  }
  for (const uri of redirectUris) {
    const parsed = new URL(uri); // throws on invalid
    if (parsed.protocol !== "https:") {
      console.error(`Redirect URIs must be https:// — got ${uri}`);
      process.exit(1);
    }
  }

  const clientId = `oc_${randomBytes(16).toString("hex")}`;
  const clientSecret = `cs_${randomBytes(32).toString("hex")}`;

  await db.oAuthClient.create({
    data: {
      clientId,
      clientSecretHash: createHash("sha256").update(clientSecret).digest("hex"),
      name,
      redirectUris,
    },
  });

  console.log(`✓ OAuth client "${name}" created`);
  console.log(`  client_id:     ${clientId}`);
  console.log(`  client_secret: ${clientSecret}`);
  console.log("");
  console.log("Save the secret now — it is not stored and cannot be recovered.");
  console.log(`  Authorization URL: https://www.mysmartfilter.com/oauth/authorize`);
  console.log(`  Token URL:         https://www.mysmartfilter.com/api/oauth/token`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
