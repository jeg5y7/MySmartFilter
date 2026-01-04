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
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          {/* Success Icon */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-4">
              <svg
                className="w-10 h-10 text-green-400"
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
            <h1 className="text-4xl font-bold text-white mb-2">Order Confirmed!</h1>
            <p className="text-gray-400">
              Thank you for your purchase. Your filter is on its way!
            </p>
          </div>

          {/* Order Summary */}
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">Order Summary</h2>

            {/* Items */}
            <div className="space-y-3 mb-4">
              {session.line_items?.data.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-300">
                    {item.description} × {item.quantity}
                  </span>
                  <span className="text-white">{formatPrice(item.amount_total)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-white">
                  {formatPrice(session.amount_subtotal)}
                </span>
              </div>
              {session.shipping_cost && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Shipping</span>
                  <span className="text-white">
                    {formatPrice(session.shipping_cost.amount_total)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold pt-2 border-t border-white/10">
                <span className="text-white">Total</span>
                <span className="text-green-400">{formatPrice(session.amount_total)}</span>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          {shippingDetails && (
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 mb-6">
              <h2 className="text-lg font-semibold text-white mb-3">Shipping To</h2>
              <div className="text-gray-300 text-sm">
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
              className="flex-1 text-center py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
            >
              View Order History
            </Link>
            <Link
              href="/store"
              className="flex-1 text-center py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
            >
              Continue Shopping
            </Link>
          </div>

          {/* Help Text */}
          <p className="text-center text-gray-500 text-sm mt-6">
            A confirmation email has been sent to your email address.
          </p>
        </div>
      </div>
    </main>
  );
}
