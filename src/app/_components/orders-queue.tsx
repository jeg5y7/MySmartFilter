"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface QueueOrder {
  id: string;
  status: string;
  isAutoOrder: boolean;
  createdAt: string;
  total: number;
  trackingNumber: string | null;
  customerEmail: string | null;
  customerName: string | null;
  shippingName: string | null;
  shippingAddress1: string | null;
  shippingAddress2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZip: string | null;
  items: { name: string; size: string; sku: string; quantity: number }[];
}

const fmtUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-300",
  pending: "bg-amber-500/15 text-amber-300",
  shipped: "bg-blue-500/15 text-blue-300",
};

function OrderRow({ order }: { order: QueueOrder }) {
  const router = useRouter();
  const [tracking, setTracking] = useState("");
  const [shipping, setShipping] = useState(false);
  const [error, setError] = useState("");

  const handleShip = async () => {
    if (!tracking.trim()) return;
    setShipping(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumber: tracking.trim() }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to mark shipped");
        setShipping(false);
      }
    } catch {
      setError("Failed to mark shipped");
      setShipping(false);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="font-mono text-sm text-gray-300">
          #{order.id.slice(-8).toUpperCase()}
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[order.status] ?? "bg-white/10 text-gray-300"}`}
        >
          {order.status}
        </span>
        {order.isAutoOrder && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/15 text-purple-300">
            auto-order
          </span>
        )}
        <span className="ml-auto text-sm text-gray-400">
          {new Date(order.createdAt).toLocaleDateString()} · {fmtUsd(order.total)}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Items</p>
          {order.items.length > 0 ? (
            order.items.map((item, i) => (
              <p key={i} className="text-gray-200">
                {item.quantity}× {item.size} — {item.name}{" "}
                <span className="text-gray-500 font-mono text-xs">{item.sku}</span>
              </p>
            ))
          ) : (
            <p className="text-amber-300/80">No items — needs manual resolution</p>
          )}
          <p className="text-gray-400 mt-2">{order.customerEmail}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Ship to</p>
          {order.shippingAddress1 ? (
            <address className="not-italic text-gray-200 leading-relaxed">
              {order.shippingName ?? order.customerName}
              <br />
              {order.shippingAddress1}
              {order.shippingAddress2 ? (
                <>
                  <br />
                  {order.shippingAddress2}
                </>
              ) : null}
              <br />
              {order.shippingCity}, {order.shippingState} {order.shippingZip}
            </address>
          ) : (
            <p className="text-amber-300/80">No address on file</p>
          )}
        </div>
      </div>

      {order.status === "shipped" && order.trackingNumber && (
        <p className="mt-3 text-sm text-blue-300">
          📦 Tracking: <span className="font-mono">{order.trackingNumber}</span>
        </p>
      )}

      {order.status === "paid" && (
        <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-3">
          <input
            type="text"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="Tracking number"
            className="flex-1 min-w-48 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <button
            onClick={handleShip}
            disabled={shipping || !tracking.trim()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all"
          >
            {shipping ? "Marking…" : "Mark Shipped"}
          </button>
          {error && <p className="w-full text-sm text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function OrdersQueue({ orders }: { orders: QueueOrder[] }) {
  const toShip = orders.filter((o) => o.status === "paid");
  const pending = orders.filter((o) => o.status === "pending");
  const shipped = orders.filter((o) => o.status === "shipped");

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">
          Ready to ship{" "}
          <span className="text-gray-500 font-normal">({toShip.length})</span>
        </h2>
        {toShip.length > 0 ? (
          <div className="space-y-4">
            {toShip.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Nothing waiting. 🎉</p>
        )}
      </section>

      {pending.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">
            Awaiting payment{" "}
            <span className="text-gray-500 font-normal">({pending.length})</span>
          </h2>
          <div className="space-y-4">
            {pending.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        </section>
      )}

      {shipped.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">
            Recently shipped{" "}
            <span className="text-gray-500 font-normal">({shipped.length})</span>
          </h2>
          <div className="space-y-4">
            {shipped.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
