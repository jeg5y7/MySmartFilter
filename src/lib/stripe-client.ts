import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { env } from "~/env";

let stripePromise: Promise<Stripe | null> | undefined;

export function getStripe(): Promise<Stripe | null> {
  if (stripePromise === undefined) {
    const key = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set");
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}
