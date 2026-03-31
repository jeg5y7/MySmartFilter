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
    <section className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 mb-6">
      <h2 className="text-xl font-semibold text-white mb-1">API Keys</h2>
      <p className="text-gray-400 text-sm mb-6">
        Use these keys to authenticate requests to{" "}
        <code className="text-blue-300 bg-white/10 px-1 py-0.5 rounded text-xs">/api/v1/*</code>
        {" "}endpoints. Keep them secret.
      </p>

      {/* New key revealed banner */}
      {revealedKey && (
        <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-green-300 text-sm font-medium mb-2">
            ✅ API key created — copy it now, it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/30 text-green-200 text-xs px-3 py-2 rounded font-mono break-all">
              {revealedKey}
            </code>
            <button
              onClick={() => void copyToClipboard(revealedKey, "new")}
              className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 text-sm rounded-lg transition-all whitespace-nowrap"
            >
              {copiedId === "new" ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setRevealedKey(null)}
            className="mt-2 text-gray-400 text-xs hover:text-white transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Existing keys */}
      {isLoading ? (
        <div className="text-gray-400 text-sm py-4">Loading…</div>
      ) : keys.length === 0 ? (
        <p className="text-gray-500 text-sm py-4">No API keys yet.</p>
      ) : (
        <div className="space-y-3 mb-6">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3 border border-white/10"
            >
              <div>
                <p className="text-white font-medium text-sm">{k.name}</p>
                <p className="text-gray-500 text-xs font-mono mt-0.5">
                  {k.key.slice(0, 18)}••••••••••••••••
                </p>
                <p className="text-gray-600 text-xs mt-0.5">
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
                className="text-red-400 hover:text-red-300 text-sm px-3 py-1 hover:bg-red-500/10 rounded-lg transition-all"
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
          className="flex-1 bg-white/10 border border-white/20 text-white placeholder-gray-500 px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-400"
        />
        <button
          onClick={() => void handleCreate()}
          disabled={!newKeyName.trim() || createKey.isPending}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createKey.isPending ? "Creating…" : "Create Key"}
        </button>
      </div>

      {/* API reference hint */}
      <div className="mt-4 p-3 bg-black/20 rounded-lg border border-white/5">
        <p className="text-gray-400 text-xs font-mono">
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
    <section className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
      <div className="flex justify-between items-start mb-1">
        <h2 className="text-xl font-semibold text-white">Webhooks</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-all"
          >
            + Add Webhook
          </button>
        )}
      </div>
      <p className="text-gray-400 text-sm mb-6">
        SmartFilter will send a signed POST request to your URL when events occur.
        Verify the{" "}
        <code className="text-blue-300 bg-white/10 px-1 py-0.5 rounded text-xs">X-SmartFilter-Signature</code>{" "}
        header (HMAC-SHA256).
      </p>

      {/* Add form */}
      {showForm && (
        <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
          <h3 className="text-white font-medium">New Webhook</h3>
          <div className="grid gap-3">
            <input
              type="text"
              placeholder="Name (e.g. Slack Notification)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="bg-white/10 border border-white/20 text-white placeholder-gray-500 px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-400"
            />
            <input
              type="url"
              placeholder="https://your-server.com/webhook"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              className="bg-white/10 border border-white/20 text-white placeholder-gray-500 px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-400"
            />
            <div>
              <p className="text-gray-400 text-sm mb-2">Events to subscribe:</p>
              <div className="space-y-2">
                {WEBHOOK_EVENTS.map((ev) => (
                  <label key={ev.value} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.events.includes(ev.value)}
                      onChange={() => toggleEvent(ev.value)}
                      className="w-4 h-4 accent-blue-500"
                    />
                    <span className="text-sm">
                      <span className="text-white font-medium">{ev.label}</span>
                      <span className="text-gray-400 ml-2">— {ev.desc}</span>
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
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-all disabled:opacity-50"
            >
              {createWebhook.isPending ? "Creating…" : "Create Webhook"}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm({ name: "", url: "", events: [] }); }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-gray-400 text-sm py-4">Loading…</div>
      ) : webhooks.length === 0 ? (
        <p className="text-gray-500 text-sm py-4">No webhooks yet.</p>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div
              key={wh.id}
              className="bg-white/5 rounded-lg px-4 py-4 border border-white/10"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-block w-2 h-2 rounded-full ${wh.enabled ? "bg-green-400" : "bg-gray-500"}`} />
                    <p className="text-white font-medium text-sm">{wh.name}</p>
                    <span className="text-gray-600 text-xs">({wh._count.deliveries} deliveries)</span>
                  </div>
                  <p className="text-gray-400 text-xs font-mono truncate">{wh.url}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {wh.events.map((ev) => (
                      <span
                        key={ev}
                        className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded-full"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => void updateWebhook.mutate({ id: wh.id, enabled: !wh.enabled })}
                    className={`text-xs px-2 py-1 rounded-lg transition-all ${
                      wh.enabled
                        ? "bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30"
                        : "bg-green-500/20 text-green-300 hover:bg-green-500/30"
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
                    className="text-red-400 hover:text-red-300 text-xs px-2 py-1 hover:bg-red-500/10 rounded-lg transition-all"
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
