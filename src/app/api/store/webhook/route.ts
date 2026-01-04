import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { stripe } from "~/lib/stripe";
import { db } from "~/server/db";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
    metadata?: { orderId?: string };
    shipping_details?: { name?: string; address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } };
    shipping_cost?: { amount_total?: number };
    amount_total?: number;
    payment_intent?: string;
  };

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
