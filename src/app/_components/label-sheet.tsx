"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

const SETUP_BASE = "https://www.mysmartfilter.com/setup/device?id=";

function Label({ deviceId, qr }: { deviceId: string; qr: string }) {
  return (
    <div className="flex flex-col items-center gap-1 border border-gray-300 rounded-lg p-3 bg-white text-black break-inside-avoid">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt={`QR for ${deviceId}`} className="w-28 h-28" />
      <p className="text-[10px] font-semibold tracking-tight">MySmartFilter</p>
      <p className="text-[9px] font-mono">{deviceId}</p>
      <p className="text-[8px] text-gray-600">Scan to set up your monitor</p>
    </div>
  );
}

export function LabelSheet({ knownDeviceIds }: { knownDeviceIds: string[] }) {
  const [selected, setSelected] = useState<string[]>(knownDeviceIds);
  const [extraText, setExtraText] = useState("");
  const [qrs, setQrs] = useState<Record<string, string>>({});

  const extras = extraText
    .split("\n")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^SF[A-Z0-9-]{4,20}$/.test(s));
  const all = [...new Set([...selected, ...extras])];

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const id of all) {
        next[id] = await QRCode.toDataURL(SETUP_BASE + id, {
          width: 240,
          margin: 1,
          errorCorrectionLevel: "M",
        });
      }
      if (!cancelled) setQrs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [all.join(",")]);

  return (
    <>
      <div className="print:hidden grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10">
          <h2 className="text-sm font-semibold text-white mb-3">
            Registered devices
          </h2>
          {knownDeviceIds.length === 0 ? (
            <p className="text-sm text-gray-500">None yet.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {knownDeviceIds.map((id) => (
                <label key={id} className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={selected.includes(id)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked ? [...prev, id] : prev.filter((x) => x !== id)
                      )
                    }
                  />
                  <span className="font-mono text-xs">{id}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10">
          <h2 className="text-sm font-semibold text-white mb-1">
            Add device IDs
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            One per line (e.g. from the flashing station) — SF followed by
            letters/numbers.
          </p>
          <textarea
            value={extraText}
            onChange={(e) => setExtraText(e.target.value)}
            rows={5}
            placeholder={"SF1A2B3C4D5E6F\nSF0F9E8D7C6B5A"}
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-600 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
      </div>

      <div className="print:hidden flex items-center justify-between mb-6">
        <p className="text-sm text-gray-400">
          {all.length} label{all.length === 1 ? "" : "s"} ready
        </p>
        <button
          onClick={() => window.print()}
          disabled={all.length === 0}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/40 text-white rounded-lg font-semibold transition-all"
        >
          🖨️ Print labels
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 print:grid-cols-4 gap-4 bg-white rounded-xl p-4 print:p-0 print:rounded-none">
        {all.map((id) =>
          qrs[id] ? <Label key={id} deviceId={id} qr={qrs[id]} /> : null
        )}
      </div>
    </>
  );
}
