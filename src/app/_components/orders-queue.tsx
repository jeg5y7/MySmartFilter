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
  paid: "bg-sagemist text-sage-deep",
  pending: "bg-clay/10 text-clay",
  shipped: "bg-mist text-body",
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
    <div className="rounded-[24px] border border-mist bg-card p-5">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="font-mono text-sm text-body">
          #{order.id.slice(-8).toUpperCase()}
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[order.status] ?? "bg-mist text-body"}`}
        >
          {order.status}
        </span>
        {order.isAutoOrder && (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-mist text-body">
            auto-order
          </span>
        )}
        <span className="ml-auto text-sm text-faint">
          {new Date(order.createdAt).toLocaleDateString()} · {fmtUsd(order.total)}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-faint text-xs font-semibold uppercase tracking-wide mb-1">Items</p>
          {order.items.length > 0 ? (
            order.items.map((item, i) => (
              <p key={i} className="text-body">
                {item.quantity}× {item.size} — {item.name}{" "}
                <span className="text-faint font-mono text-xs">{item.sku}</span>
              </p>
            ))
          ) : (
            <p className="text-clay">No items — needs manual resolution</p>
          )}
          <p className="text-faint mt-2">{order.customerEmail}</p>
        </div>
        <div>
          <p className="text-faint text-xs font-semibold uppercase tracking-wide mb-1">Ship to</p>
          {order.shippingAddress1 ? (
            <address className="not-italic text-body leading-relaxed">
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
            <p className="text-clay">No address on file</p>
          )}
        </div>
      </div>

      {order.status === "shipped" && order.trackingNumber && (
        <p className="mt-3 text-sm text-body">
          📦 Tracking: <span className="font-mono">{order.trackingNumber}</span>
        </p>
      )}

      {order.status === "paid" && (
        <div className="mt-4 pt-4 border-t border-mist flex flex-wrap gap-3">
          <input
            type="text"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="Tracking number"
            className="flex-1 min-w-48 rounded-full border border-mist bg-card px-4 py-2 text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20"
          />
          <button
            onClick={handleShip}
            disabled={shipping || !tracking.trim()}
            className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper transition hover:bg-ink/85 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {shipping ? "Marking…" : "Mark Shipped"}
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
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
        <h2 className="text-lg font-semibold text-ink mb-3">
          Ready to ship{" "}
          <span className="text-faint font-normal">({toShip.length})</span>
        </h2>
        {toShip.length > 0 ? (
          <div className="space-y-4">
            {toShip.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-faint">Nothing waiting. 🎉</p>
        )}
      </section>

      {pending.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-ink mb-3">
            Awaiting payment{" "}
            <span className="text-faint font-normal">({pending.length})</span>
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
          <h2 className="text-lg font-semibold text-ink mb-3">
            Recently shipped{" "}
            <span className="text-faint font-normal">({shipped.length})</span>
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
