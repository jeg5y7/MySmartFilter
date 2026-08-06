import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { stripe } from "~/lib/stripe";
import { env } from "~/env";

interface CheckoutItem {
  productId: string;
  quantity: number;
}

interface CheckoutRequest {
  items: CheckoutItem[];
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Please sign in to checkout" }, { status: 401 });
    }

    const body = (await request.json()) as CheckoutRequest;
    const { items } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 });
    }

    // Fetch products from database
    const productIds = items.map((item) => item.productId);
    const products = await db.filterProduct.findMany({
      where: { id: { in: productIds }, inStock: true },
    });

    if (products.length !== items.length) {
      return NextResponse.json(
        { error: "Some products are no longer available" },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    let stripeCustomerId = (await db.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    }))?.stripeCustomerId;

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

    // Calculate totals and create line items
    const lineItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            description: `${product.size}${product.merv ? ` - MERV ${product.merv}` : ""}`,
          },
          unit_amount: product.price,
        },
        quantity: item.quantity,
      };
    });

    const subtotal = items.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId)!;
      return sum + product.price * item.quantity;
    }, 0);

    // Create order in database (pending status)
    const order = await db.order.create({
      data: {
        userId: session.user.id,
        status: "pending",
        subtotal,
        total: subtotal, // Will be updated with tax/shipping by webhook
        orderItems: {
          create: items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            return {
              filterProductId: product.id,
              quantity: item.quantity,
              priceAtPurchase: product.price,
            };
          }),
        },
      },
    });

    // Create Stripe checkout session
    const baseUrl = env.NEXTAUTH_URL ?? "http://localhost:3000";
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "payment",
      payment_method_types: ["card"],
      // Save the card so auto-orders can charge off-session later
      payment_intent_data: { setup_future_usage: "off_session" },
      line_items: lineItems,
      shipping_address_collection: {
        allowed_countries: ["US"],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 599, currency: "usd" },
            display_name: "Standard Shipping",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 5 },
              maximum: { unit: "business_day", value: 7 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 1299, currency: "usd" },
            display_name: "Express Shipping",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 2 },
              maximum: { unit: "business_day", value: 3 },
            },
          },
        },
      ],
      success_url: `${baseUrl}/store/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/store`,
      metadata: {
        orderId: order.id,
        userId: session.user.id,
      },
    });

    // Update order with Stripe session ID
    await db.order.update({
      where: { id: order.id },
      data: { stripeSessionId: checkoutSession.id },
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
