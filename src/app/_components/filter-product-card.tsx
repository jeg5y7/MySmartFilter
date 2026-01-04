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

      const data = await response.json() as { sessionId?: string; error?: string };
      
      if (data.error) {
        alert(data.error);
        return;
      }

      if (data.sessionId) {
        // Redirect to Stripe Checkout
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
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 flex flex-col">
      {/* Product Image Placeholder */}
      <div className="bg-white/10 rounded-lg h-40 mb-4 flex items-center justify-center">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover rounded-lg"
          />
        ) : (
          <div className="text-4xl">🔲</div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-grow">
        <h3 className="text-lg font-semibold text-white mb-1">{product.name}</h3>
        <p className="text-2xl font-bold text-blue-400 mb-2">
          {product.size}
        </p>
        {product.merv && (
          <span className="inline-block px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full mb-2">
            MERV {product.merv}
          </span>
        )}
        {product.description && (
          <p className="text-gray-400 text-sm mb-4">{product.description}</p>
        )}
      </div>

      {/* Price and Actions */}
      <div className="mt-auto pt-4 border-t border-white/10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl font-bold text-white">
            {formatPrice(product.price)}
          </span>
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
        </div>
        <button
          onClick={handleCheckout}
          disabled={isLoading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg font-semibold transition-all"
        >
          {isLoading ? "Processing..." : isLoggedIn ? "Buy Now" : "Sign in to Buy"}
        </button>
      </div>
    </div>
  );
}
