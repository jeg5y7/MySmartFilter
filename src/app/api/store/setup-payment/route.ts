import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { stripe } from "~/lib/stripe";
import { env } from "~/env";

/**
 * POST /api/store/setup-payment
 * Creates a Stripe Checkout session in setup mode so the user can save a card
 * for auto-orders without buying anything. The webhook stores the resulting
 * payment method on the user.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Please sign in" }, { status: 401 });
    }

    // Get or create Stripe customer
    let stripeCustomerId = (
      await db.user.findUnique({
        where: { id: session.user.id },
        select: { stripeCustomerId: true },
      })
    )?.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
        metadata: { userId: session.user.id },
      });
      stripeCustomerId = customer.id;
      await db.user.update({
        where: { id: session.user.id },
        data: { stripeCustomerId },
      });
    }

    const baseUrl = env.NEXTAUTH_URL ?? "http://localhost:3000";
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "setup",
      payment_method_types: ["card"],
      success_url: `${baseUrl}/settings/billing?setup=success`,
      cancel_url: `${baseUrl}/settings/billing`,
      metadata: { userId: session.user.id },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Setup payment error:", error);
    return NextResponse.json(
      { error: "Failed to start card setup" },
      { status: 500 }
    );
  }
}
