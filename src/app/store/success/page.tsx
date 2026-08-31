import Link from "next/link";
import { redirect } from "next/navigation";
import { stripe } from "~/lib/stripe";
import type Stripe from "stripe";

interface SuccessPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams;
  const sessionId = params.session_id;

  if (!sessionId) {
    redirect("/store");
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "shipping_cost"],
    });
  } catch {
    redirect("/store");
  }

  // Extract shipping details - use collected_information for newer Stripe API
  const shippingDetails = (session as unknown as { shipping_details?: { name?: string; address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } } }).shipping_details;

  const formatPrice = (amount: number | null) => {
    if (amount === null) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount / 100);
  };

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto w-full px-4 py-16">
        <div className="max-w-2xl mx-auto">
          {/* Success Icon */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-sagemist rounded-full mb-4">
              <svg
                className="w-10 h-10 text-sage"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-ink mb-2">Order Confirmed!</h1>
            <p className="text-body">
              Thank you for your purchase. Your filter is on its way!
            </p>
          </div>

          {/* Order Summary */}
          <div className="rounded-[24px] border border-mist bg-card p-6 mb-6">
            <h2 className="text-lg font-semibold text-ink mb-4">Order Summary</h2>

            {/* Items */}
            <div className="space-y-3 mb-4">
              {session.line_items?.data.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-body">
                    {item.description} × {item.quantity}
                  </span>
                  <span className="text-ink">{formatPrice(item.amount_total)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-mist pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-faint">Subtotal</span>
                <span className="text-ink">
                  {formatPrice(session.amount_subtotal)}
                </span>
              </div>
              {session.shipping_cost && (
                <div className="flex justify-between text-sm">
                  <span className="text-faint">Shipping</span>
                  <span className="text-ink">
                    {formatPrice(session.shipping_cost.amount_total)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold pt-2 border-t border-mist">
                <span className="text-ink">Total</span>
                <span className="text-sage">{formatPrice(session.amount_total)}</span>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          {shippingDetails && (
            <div className="rounded-[24px] border border-mist bg-card p-6 mb-6">
              <h2 className="text-lg font-semibold text-ink mb-3">Shipping To</h2>
              <div className="text-body text-sm">
                <p>{shippingDetails.name}</p>
                <p>{shippingDetails.address?.line1}</p>
                {shippingDetails.address?.line2 && (
                  <p>{shippingDetails.address.line2}</p>
                )}
                <p>
                  {shippingDetails.address?.city},{" "}
                  {shippingDetails.address?.state}{" "}
                  {shippingDetails.address?.postal_code}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/store/orders"
              className="flex-1 text-center rounded-full border border-mist bg-card py-3 text-sm font-semibold text-ink transition hover:bg-mist/60"
            >
              View Order History
            </Link>
            <Link
              href="/store"
              className="flex-1 text-center rounded-full bg-sage py-3 text-sm font-semibold text-white transition hover:bg-sage-deep"
            >
              Continue Shopping
            </Link>
          </div>

          {/* Help Text */}
          <p className="text-center text-faint text-sm mt-6">
            A confirmation email has been sent to your email address.
          </p>
        </div>
      </div>
    </main>
  );
}
