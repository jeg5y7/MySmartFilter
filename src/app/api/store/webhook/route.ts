import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { stripe } from "~/lib/stripe";
import { db } from "~/server/db";
import { env } from "~/env";

const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature || !webhookSecret) {
    console.error("Missing signature or webhook secret");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutComplete(event.data.object);
        break;
      }
      case "checkout.session.expired": {
        await handleCheckoutExpired(event.data.object);
        break;
      }
      case "payment_intent.payment_failed": {
        await handlePaymentFailed(event.data.object);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

async function handleCheckoutComplete(eventObject: Stripe.Event.Data.Object) {
  // Cast to checkout session type
  const session = eventObject as unknown as {
    mode?: string;
    metadata?: { orderId?: string; userId?: string };
    shipping_details?: { name?: string; address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } };
    shipping_cost?: { amount_total?: number };
    amount_total?: number;
    payment_intent?: string;
    setup_intent?: string;
  };

  // Setup-mode sessions (add/update card, no purchase) just save the payment method
  if (session.mode === "setup") {
    const userId = session.metadata?.userId;
    if (userId && session.setup_intent) {
      const setupIntent = await stripe.setupIntents.retrieve(session.setup_intent);
      const pm =
        typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent.payment_method?.id;
      if (pm) {
        await db.user.update({
          where: { id: userId },
          data: { stripeDefaultPaymentMethodId: pm },
        });
        console.log(`Saved payment method for user ${userId}`);
      }
    }
    return;
  }

  const orderId = session.metadata?.orderId;
  if (!orderId) {
    console.error("No orderId in session metadata");
    return;
  }

  const shippingDetails = session.shipping_details;
  const shippingCost = session.shipping_cost?.amount_total ?? 0;
  const totalAmount = session.amount_total ?? 0;

  await db.order.update({
    where: { id: orderId },
    data: {
      status: "paid",
      stripePaymentIntent: session.payment_intent ?? null,
      shipping: shippingCost,
      total: totalAmount,
      shippingName: shippingDetails?.name ?? null,
      shippingAddress1: shippingDetails?.address?.line1 ?? null,
      shippingAddress2: shippingDetails?.address?.line2 ?? null,
      shippingCity: shippingDetails?.address?.city ?? null,
      shippingState: shippingDetails?.address?.state ?? null,
      shippingZip: shippingDetails?.address?.postal_code ?? null,
      shippingCountry: shippingDetails?.address?.country ?? "US",
    },
  });

  console.log(`Order ${orderId} marked as paid`);

  // Persist the card + freshest shipping address to the user for auto-orders
  const buyerId = session.metadata?.userId;
  if (buyerId) {
    let pm: string | undefined;
    if (session.payment_intent) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
        pm =
          typeof paymentIntent.payment_method === "string"
            ? paymentIntent.payment_method
            : paymentIntent.payment_method?.id;
      } catch (err) {
        console.error("Could not retrieve payment intent for card save:", err);
      }
    }

    await db.user.update({
      where: { id: buyerId },
      data: {
        ...(pm && { stripeDefaultPaymentMethodId: pm }),
        ...(shippingDetails?.address?.line1 && {
          shippingName: shippingDetails.name ?? null,
          shippingAddress1: shippingDetails.address.line1,
          shippingAddress2: shippingDetails.address.line2 ?? null,
          shippingCity: shippingDetails.address.city ?? null,
          shippingState: shippingDetails.address.state ?? null,
          shippingZip: shippingDetails.address.postal_code ?? null,
          shippingCountry: shippingDetails.address.country ?? "US",
        }),
      },
    });
  }

  // Check if this order was triggered by a filter alert
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { triggeredByAlertId: true },
  });

  if (order?.triggeredByAlertId) {
    await db.filterAlert.update({
      where: { id: order.triggeredByAlertId },
      data: {
        status: "manual_ordered",
        resolvedAt: new Date(),
      },
    });
  }
}

async function handleCheckoutExpired(eventObject: Stripe.Event.Data.Object) {
  const session = eventObject as unknown as { metadata?: { orderId?: string } };
  const orderId = session.metadata?.orderId;
  if (!orderId) return;

  await db.order.update({
    where: { id: orderId },
    data: { status: "cancelled" },
  });

  console.log(`Order ${orderId} cancelled (checkout expired)`);
}

async function handlePaymentFailed(eventObject: Stripe.Event.Data.Object) {
  const paymentIntent = eventObject as unknown as { id: string };
  const order = await db.order.findUnique({
    where: { stripePaymentIntent: paymentIntent.id },
  });

  if (order) {
    await db.order.update({
      where: { id: order.id },
      data: { status: "cancelled" },
    });
    console.log(`Order ${order.id} cancelled (payment failed)`);
  }
}
