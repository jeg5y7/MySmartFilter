"use client";

import { useState } from "react";
import { type FilterProduct } from "@prisma/client";

interface FilterProductCardProps {
  product: FilterProduct;
  isLoggedIn: boolean;
}

export function FilterProductCard({ product, isLoggedIn }: FilterProductCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(priceInCents / 100);
  };

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
        body: JSON.stringify({
          items: [{ productId: product.id, quantity }],
        }),
      });

      const data = await response.json() as { sessionId?: string; url?: string; error?: string };

      if (data.error) {
        alert(data.error);
        return;
      }

      if (data.url) {
        // Stripe's own checkout URL — the reliable redirect
        window.location.href = data.url;
      } else if (data.sessionId) {
        window.location.href = `https://checkout.stripe.com/c/pay/${data.sessionId}`;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-mist bg-card p-6 flex flex-col">
      {/* Product Image Placeholder */}
      <div className="bg-mist rounded-2xl h-40 mb-4 flex items-center justify-center">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover rounded-2xl"
          />
        ) : (
          <div className="text-4xl">🔲</div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-grow">
        <h3 className="text-lg font-semibold text-ink mb-1">{product.name}</h3>
        <p className="text-2xl font-semibold text-body mb-2">
          {product.size}
        </p>
        {product.merv && (
          <span className="inline-block rounded-full bg-sagemist px-3 py-1 text-xs font-semibold text-sage-deep mb-2">
            MERV {product.merv}
          </span>
        )}
        {product.description && (
          <p className="text-faint text-sm mb-4">{product.description}</p>
        )}
      </div>

      {/* Price and Actions */}
      <div className="mt-auto pt-4 border-t border-mist">
        <div className="flex items-center justify-between mb-3">
          <span className="font-display text-3xl text-ink">
            {formatPrice(product.price)}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 rounded-full border border-mist bg-card text-ink transition hover:bg-mist/60"
            >
              -
            </button>
            <span className="text-ink w-8 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 rounded-full border border-mist bg-card text-ink transition hover:bg-mist/60"
            >
              +
            </button>
          </div>
        </div>
        <button
          onClick={handleCheckout}
          disabled={isLoading}
          className="w-full rounded-full bg-sage py-3 text-sm font-semibold text-white transition hover:bg-sage-deep disabled:bg-sage/50"
        >
          {isLoading ? "Processing..." : isLoggedIn ? "Buy Now" : "Sign in to Buy"}
        </button>
      </div>
    </div>
  );
}
