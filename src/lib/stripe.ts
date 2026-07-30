import Stripe from "stripe";
import { env } from "~/env";

/**
 * Lazy Stripe client: instantiated on first use, not at import time.
 * Next.js loads route modules during `next build`, and preview deploys may
 * not have STRIPE_SECRET_KEY — the build must not crash on import. A missing
 * key throws at the first actual Stripe call instead.
 */
let stripeClient: Stripe | undefined;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    });
  }
  return stripeClient;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripeClient();
    const value = Reflect.get(client, prop, client) as unknown;
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});

export function formatPrice(priceInCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(priceInCents / 100);
}
