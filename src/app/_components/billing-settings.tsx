"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

const inputCls =
  "w-full rounded-full border border-mist bg-card px-4 py-2.5 text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all";

export function BillingSettings() {
  const utils = api.useUtils();
  const { data: billing, isLoading } = api.user.getBilling.useQuery();

  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState("");

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
  });
  const updateShipping = api.user.updateShipping.useMutation({
    onSuccess: () => {
      setEditing(false);
      void utils.user.getBilling.invalidate();
    },
  });

  const handleAddCard = async () => {
    setCardLoading(true);
    setCardError("");
    try {
      const res = await fetch("/api/store/setup-payment", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setCardError(data.error ?? "Failed to start card setup");
        setCardLoading(false);
      }
    } catch {
      setCardError("Failed to start card setup");
      setCardLoading(false);
    }
  };

  const startEditing = () => {
    setForm({
      name: billing?.shipping?.name ?? "",
      address1: billing?.shipping?.address1 ?? "",
      address2: billing?.shipping?.address2 ?? "",
      city: billing?.shipping?.city ?? "",
      state: billing?.shipping?.state ?? "",
      zip: billing?.shipping?.zip ?? "",
    });
    setEditing(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Card on file ─────────────────────────────────────────────────── */}
      <div className="rounded-[24px] border border-mist bg-card p-6">
        <h2 className="text-lg font-semibold text-ink mb-1">Payment Method</h2>
        <p className="text-sm text-faint mb-5">
          Auto-orders charge this card. Without one, auto-orders are created but
          wait for manual payment.
        </p>

        {billing?.card ? (
          <div className="flex items-center justify-between rounded-2xl border border-mist bg-mist/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💳</span>
              <div>
                <p className="text-ink font-medium capitalize">
                  {billing.card.brand} •••• {billing.card.last4}
                </p>
                <p className="text-xs text-faint">
                  Expires {String(billing.card.expMonth).padStart(2, "0")}/
                  {billing.card.expYear}
                </p>
              </div>
            </div>
            <button
              onClick={handleAddCard}
              disabled={cardLoading}
              className="rounded-full border border-mist bg-card px-4 py-2 text-sm font-semibold text-ink transition-all hover:bg-mist/60 disabled:opacity-50"
            >
              {cardLoading ? "Opening…" : "Update Card"}
            </button>
          </div>
        ) : (
          <button
            onClick={handleAddCard}
            disabled={cardLoading}
            className="w-full rounded-full bg-sage py-3 font-semibold text-white transition-all hover:bg-sage-deep disabled:bg-sage/40"
          >
            {cardLoading ? "Opening Stripe…" : "＋ Add a Card"}
          </button>
        )}
        {cardError && <p className="mt-3 text-sm text-red-600">{cardError}</p>}
      </div>

      {/* ── Shipping address ─────────────────────────────────────────────── */}
      <div className="rounded-[24px] border border-mist bg-card p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-ink">Shipping Address</h2>
          {!editing && (
            <button
              onClick={startEditing}
              className="text-sm text-sage hover:text-sage-deep transition-colors"
            >
              {billing?.shipping ? "Edit" : "Add"}
            </button>
          )}
        </div>
        <p className="text-sm text-faint mb-5">
          Auto-ordered filters ship here. Updated automatically from your latest
          store checkout.
        </p>

        {!editing && billing?.shipping && (
          <address className="not-italic text-sm text-body leading-relaxed">
            {billing.shipping.name}
            <br />
            {billing.shipping.address1}
            {billing.shipping.address2 ? (
              <>
                <br />
                {billing.shipping.address2}
              </>
            ) : null}
            <br />
            {billing.shipping.city}, {billing.shipping.state} {billing.shipping.zip}
          </address>
        )}

        {!editing && !billing?.shipping && (
          <p className="text-sm text-clay">
            No address on file — auto-orders can't ship until you add one.
          </p>
        )}

        {editing && (
          <div className="space-y-3">
            <input
              className={inputCls}
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="Street address"
              value={form.address1}
              onChange={(e) => setForm({ ...form, address1: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="Apt, suite, etc. (optional)"
              value={form.address2}
              onChange={(e) => setForm({ ...form, address2: e.target.value })}
            />
            <div className="grid grid-cols-3 gap-3">
              <input
                className={inputCls}
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
              <input
                className={inputCls}
                placeholder="State"
                maxLength={2}
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
              <input
                className={inputCls}
                placeholder="ZIP"
                value={form.zip}
                onChange={(e) => setForm({ ...form, zip: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() =>
                  updateShipping.mutate({
                    name: form.name,
                    address1: form.address1,
                    address2: form.address2 || undefined,
                    city: form.city,
                    state: form.state,
                    zip: form.zip,
                  })
                }
                disabled={updateShipping.isPending}
                className="flex-1 rounded-full bg-sage py-2.5 text-sm font-semibold text-white transition-all hover:bg-sage-deep disabled:bg-sage/40"
              >
                {updateShipping.isPending ? "Saving…" : "Save Address"}
              </button>
              <button
                onClick={() => setEditing(false)}
                disabled={updateShipping.isPending}
                className="flex-1 rounded-full border border-mist bg-card py-2.5 text-sm font-semibold text-ink transition-all hover:bg-mist/60 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
            {updateShipping.error && (
              <p className="text-sm text-red-600">
                {updateShipping.error.message.includes("[")
                  ? "Please fill in all required fields (2-letter state, 5-digit ZIP)."
                  : updateShipping.error.message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
