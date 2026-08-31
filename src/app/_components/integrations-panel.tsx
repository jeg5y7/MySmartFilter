"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

const WEBHOOK_EVENTS = [
  { value: "filter.alert", label: "Filter Alert", desc: "When a filter needs replacement" },
  { value: "device.offline", label: "Device Offline", desc: "When a device goes offline" },
  { value: "reading.threshold", label: "Threshold Exceeded", desc: "When pressure exceeds threshold" },
] as const;

type WebhookEvent = typeof WEBHOOK_EVENTS[number]["value"];

// ─── API Keys Section ────────────────────────────────────────────────────────

function ApiKeysSection() {
  const utils = api.useUtils();
  const { data: keys = [], isLoading } = api.integrations.listApiKeys.useQuery();
  const createKey = api.integrations.createApiKey.useMutation({
    onSuccess: () => void utils.integrations.listApiKeys.invalidate(),
  });
  const deleteKey = api.integrations.deleteApiKey.useMutation({
    onSuccess: () => void utils.integrations.listApiKeys.invalidate(),
  });

  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    const result = await createKey.mutateAsync({ name: newKeyName.trim() });
    setRevealedKey(result.key);
    setNewKeyName("");
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section className="rounded-[24px] border border-mist bg-card p-6 mb-6">
      <h2 className="text-xl font-semibold text-ink mb-1">API Keys</h2>
      <p className="text-faint text-sm mb-6">
        Use these keys to authenticate requests to{" "}
        <code className="rounded bg-mist/60 px-1 py-0.5 font-mono text-xs text-ink">/api/v1/*</code>
        {" "}endpoints. Keep them secret.
      </p>

      {/* New key revealed banner */}
      {revealedKey && (
        <div className="mb-4 rounded-2xl border border-sage/30 bg-sagemist p-4">
          <p className="text-sage-deep text-sm font-medium mb-2">
            ✅ API key created — copy it now, it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-xl bg-mist/60 px-3 py-2 font-mono text-xs text-ink break-all">
              {revealedKey}
            </code>
            <button
              onClick={() => void copyToClipboard(revealedKey, "new")}
              className="rounded-full border border-mist bg-card px-3 py-2 text-sm font-semibold text-ink transition-all hover:bg-mist/60 whitespace-nowrap"
            >
              {copiedId === "new" ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setRevealedKey(null)}
            className="mt-2 text-faint text-xs hover:text-ink transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Existing keys */}
      {isLoading ? (
        <div className="text-faint text-sm py-4">Loading…</div>
      ) : keys.length === 0 ? (
        <p className="text-faint text-sm py-4">No API keys yet.</p>
      ) : (
        <div className="space-y-3 mb-6">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between rounded-2xl border border-mist bg-mist/30 px-4 py-3"
            >
              <div>
                <p className="text-ink font-medium text-sm">{k.name}</p>
                <p className="text-faint text-xs font-mono mt-0.5">
                  {k.key.slice(0, 18)}••••••••••••••••
                </p>
                <p className="text-whisper text-xs mt-0.5">
                  Created {new Date(k.createdAt).toLocaleDateString()}
                  {k.lastUsed ? ` · Last used ${new Date(k.lastUsed).toLocaleDateString()}` : " · Never used"}
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Revoke API key "${k.name}"? This cannot be undone.`)) {
                    void deleteKey.mutate({ id: k.id });
                  }
                }}
                className="rounded-full border border-red-200 px-3 py-1 text-sm text-red-600 transition-all hover:bg-red-50"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create new */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Key name (e.g. Home Assistant)"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
          className="flex-1 rounded-full border border-mist bg-card px-4 py-2 text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20"
        />
        <button
          onClick={() => void handleCreate()}
          disabled={!newKeyName.trim() || createKey.isPending}
          className="rounded-full bg-sage px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-sage-deep disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createKey.isPending ? "Creating…" : "Create Key"}
        </button>
      </div>

      {/* API reference hint */}
      <div className="mt-4 rounded-xl bg-mist/60 px-3 py-2">
        <p className="font-mono text-xs text-ink">
          curl https://mysmartfilter.com/api/v1/devices \<br />
          {"  "}-H &quot;Authorization: Bearer sk_live_...&quot;
        </p>
      </div>
    </section>
  );
}

// ─── Webhooks Section ─────────────────────────────────────────────────────────

function WebhooksSection() {
  const utils = api.useUtils();
  const { data: webhooks = [], isLoading } = api.integrations.listWebhooks.useQuery();
  const createWebhook = api.integrations.createWebhook.useMutation({
    onSuccess: () => {
      void utils.integrations.listWebhooks.invalidate();
      setShowForm(false);
      setForm({ name: "", url: "", events: [] });
    },
  });
  const updateWebhook = api.integrations.updateWebhook.useMutation({
    onSuccess: () => void utils.integrations.listWebhooks.invalidate(),
  });
  const deleteWebhook = api.integrations.deleteWebhook.useMutation({
    onSuccess: () => void utils.integrations.listWebhooks.invalidate(),
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ name: string; url: string; events: WebhookEvent[] }>({
    name: "",
    url: "",
    events: [],
  });

  const toggleEvent = (event: WebhookEvent) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(event) ? f.events.filter((e) => e !== event) : [...f.events, event],
    }));
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.url.trim() || form.events.length === 0) return;
    await createWebhook.mutateAsync({ name: form.name, url: form.url, events: form.events });
  };

  return (
    <section className="rounded-[24px] border border-mist bg-card p-6">
      <div className="flex justify-between items-start mb-1">
        <h2 className="text-xl font-semibold text-ink">Webhooks</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-full bg-sage px-3 py-1.5 text-sm font-semibold text-white transition-all hover:bg-sage-deep"
          >
            + Add Webhook
          </button>
        )}
      </div>
      <p className="text-faint text-sm mb-6">
        SmartFilter will send a signed POST request to your URL when events occur.
        Verify the{" "}
        <code className="rounded bg-mist/60 px-1 py-0.5 font-mono text-xs text-ink">X-SmartFilter-Signature</code>{" "}
        header (HMAC-SHA256).
      </p>

      {/* Add form */}
      {showForm && (
        <div className="mb-6 rounded-2xl border border-mist bg-mist/30 p-4 space-y-4">
          <h3 className="text-ink font-medium">New Webhook</h3>
          <div className="grid gap-3">
            <input
              type="text"
              placeholder="Name (e.g. Slack Notification)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-full border border-mist bg-card px-4 py-2 text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20"
            />
            <input
              type="url"
              placeholder="https://your-server.com/webhook"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              className="rounded-full border border-mist bg-card px-4 py-2 text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20"
            />
            <div>
              <p className="text-faint text-sm mb-2">Events to subscribe:</p>
              <div className="space-y-2">
                {WEBHOOK_EVENTS.map((ev) => (
                  <label key={ev.value} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.events.includes(ev.value)}
                      onChange={() => toggleEvent(ev.value)}
                      className="w-4 h-4 accent-sage"
                    />
                    <span className="text-sm">
                      <span className="text-ink font-medium">{ev.label}</span>
                      <span className="text-faint ml-2">— {ev.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => void handleCreate()}
              disabled={!form.name || !form.url || form.events.length === 0 || createWebhook.isPending}
              className="rounded-full bg-sage px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-sage-deep disabled:opacity-50"
            >
              {createWebhook.isPending ? "Creating…" : "Create Webhook"}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm({ name: "", url: "", events: [] }); }}
              className="rounded-full border border-mist bg-card px-4 py-2 text-sm font-semibold text-ink transition-all hover:bg-mist/60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-faint text-sm py-4">Loading…</div>
      ) : webhooks.length === 0 ? (
        <p className="text-faint text-sm py-4">No webhooks yet.</p>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div
              key={wh.id}
              className="rounded-2xl border border-mist bg-mist/30 px-4 py-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-block w-2 h-2 rounded-full ${wh.enabled ? "bg-sage" : "bg-whisper"}`} />
                    <p className="text-ink font-medium text-sm">{wh.name}</p>
                    <span className="text-whisper text-xs">({wh._count.deliveries} deliveries)</span>
                  </div>
                  <p className="text-faint text-xs font-mono truncate">{wh.url}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {wh.events.map((ev) => (
                      <span
                        key={ev}
                        className="rounded-full bg-sagemist px-2 py-0.5 text-xs font-semibold text-sage-deep"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => void updateWebhook.mutate({ id: wh.id, enabled: !wh.enabled })}
                    className={`text-xs px-2 py-1 rounded-full font-semibold transition-all ${
                      wh.enabled
                        ? "bg-clay/10 text-clay hover:bg-clay/20"
                        : "bg-sagemist text-sage-deep hover:bg-sagemist/70"
                    }`}
                  >
                    {wh.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete webhook "${wh.name}"?`)) {
                        void deleteWebhook.mutate({ id: wh.id });
                      }
                    }}
                    className="rounded-full border border-red-200 px-2 py-1 text-xs text-red-600 transition-all hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function IntegrationsPanel() {
  return (
    <div>
      <ApiKeysSection />
      <WebhooksSection />
    </div>
  );
}
