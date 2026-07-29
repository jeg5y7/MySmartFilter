import Stripe from "stripe";
import { env } from "~/env";

if (!env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-12-15.clover",
  typescript: true,
});

export function formatPrice(priceInCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(priceInCents / 100);
}
