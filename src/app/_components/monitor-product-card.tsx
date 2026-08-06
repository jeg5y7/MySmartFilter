"use client";

import { useState } from "react";
import Link from "next/link";
import { type FilterProduct } from "@prisma/client";

/**
 * Hero card for the smart filter monitor itself — the hardware that makes
 * the store's filters auto-ship themselves.
 */
export function MonitorProductCard({
  product,
  isLoggedIn,
}: {
  product: FilterProduct;
  isLoggedIn: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const price = (product.price / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  const handleCheckout = async () => {
    if (!isLoggedIn) {
      window.location.href = "/api/auth/signin";
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ productId: product.id, quantity }] }),
      });
      const data = (await response.json()) as {
        sessionId?: string;
        url?: string;
        error?: string;
      };
      if (data.error) {
        alert(data.error);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else if (data.sessionId) {
        window.location.href = `https://checkout.stripe.com/c/pay/${data.sessionId}`;
      }
    } catch {
      alert("Failed to start checkout. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/10 backdrop-blur-lg rounded-2xl border border-blue-500/30 p-6 sm:p-8 mb-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-center">
        {/* Visual */}
        <div className="bg-[#0d1526] rounded-xl border border-white/10 h-52 sm:h-64 flex items-center justify-center">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-cover rounded-xl"
            />
          ) : (
            <div className="text-center">
              <div className="inline-flex h-20 w-28 items-center justify-center rounded-2xl bg-blue-600/20 border-2 border-blue-500/40 mb-3">
                <span className="block h-5 w-12 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400" />
              </div>
              <p className="text-xs text-gray-500 font-mono">smart filter monitor</p>
            </div>
          )}
        </div>

        {/* Pitch + buy */}
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-blue-300 mb-2">
            The hardware
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            {product.name}
          </h2>
          <p className="text-gray-300 text-sm mb-4">
            {product.description ??
              "Measures the pressure drop across your filter and tells you when replacing it costs less than the energy it wastes."}
          </p>
          <ul className="text-sm text-gray-400 space-y-1.5 mb-5">
            <li>✓ 15-minute install — drill one small hole on each side of your filter</li>
            <li>✓ Live dashboard + Home Assistant, free forever</li>
            <li>✓ Add Filter AutoShip and filters ship themselves — no fees</li>
          </ul>

          <div className="flex flex-wrap items-center gap-4">
            <span className="text-3xl font-bold text-white">{price}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 rounded bg-white/10 hover:bg-white/20 text-white"
              >
                -
              </button>
              <span className="text-white w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 rounded bg-white/10 hover:bg-white/20 text-white"
              >
                +
              </button>
            </div>
            <button
              onClick={handleCheckout}
              disabled={isLoading}
              className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg font-semibold transition-all"
            >
              {isLoading ? "Processing…" : isLoggedIn ? "Buy the Monitor" : "Sign in to Buy"}
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Arrives assembled with the install kit — tubes, grommets, power
            adapter, and the QR setup label.{" "}
            <Link href="/install" className="text-blue-400 hover:text-blue-300">
              See how installation works →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
