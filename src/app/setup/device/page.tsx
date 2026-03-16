"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

interface ProvisionResponse {
  sessionToken: string;
  deviceId: string;
  error?: string;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function StepProgress({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: "Power On" },
    { n: 2, label: "Connect" },
    { n: 3, label: "Name It" },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  current > s.n
                    ? "bg-green-500 text-white"
                    : current === s.n
                    ? "bg-blue-600 text-white ring-2 ring-blue-400/50"
                    : "bg-white/10 text-gray-400"
                }`}
              >
                {current > s.n ? "✓" : s.n}
              </div>
              <span
                className={`mt-1 text-xs whitespace-nowrap ${
                  current === s.n ? "text-blue-400" : "text-gray-500"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${
                  current > s.n ? "bg-green-500" : "bg-white/10"
                }`}
              />
            )}
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-gray-500">Step {current} of 3</p>
    </div>
  );
}

// ─── Step 1 — Power On ────────────────────────────────────────────────────────

function Step1PowerOn({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold text-white mb-2">Power On Your Device</h1>
      <p className="text-gray-400 mb-8">
        Press the button on your Smart Filter device. The LED will blink blue when it&apos;s ready.
      </p>

      {/* Animated pulsing blue circle */}
      <div className="flex justify-center mb-8">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400/20 animate-pulse" />
          <span className="absolute inline-flex h-16 w-16 rounded-full bg-blue-400/30 animate-pulse" />
          <span className="relative inline-flex rounded-full h-10 w-10 bg-blue-400 animate-pulse" />
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all active:scale-95"
      >
        Next →
      </button>
    </div>
  );
}

// ─── Step 2 — Enter Device ID ─────────────────────────────────────────────────

const DEVICE_ID_REGEX = /^SF[A-Za-z0-9]{14}$/;

function Step2EnterDeviceId({
  onNext,
  onBack,
}: {
  onNext: (sessionToken: string, deviceId: string) => void;
  onBack: () => void;
}) {
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidFormat = DEVICE_ID_REGEX.test(deviceId.trim());

  const handleConnect = async () => {
    const trimmed = deviceId.trim().toUpperCase();

    if (!DEVICE_ID_REGEX.test(trimmed)) {
      setError(
        "Device ID must start with SF followed by 14 alphanumeric characters (e.g. SF1234567890ABCD)"
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/device/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: trimmed }),
      });

      const data = (await res.json()) as ProvisionResponse;

      if (!res.ok) {
        setError(data.error ?? "Device not found. Check the ID and try again.");
        return;
      }

      onNext(data.sessionToken, data.deviceId);
    } catch {
      setError("Connection failed. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Enter Your Device ID</h1>
      <p className="text-gray-400 mb-6">
        Find the Device ID printed on the label or the QR code sticker on your device.
      </p>

      {/* Device ID Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Device ID
        </label>
        <input
          type="text"
          value={deviceId}
          onChange={(e) => {
            setDeviceId(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          placeholder="SF1234567890ABCD"
          maxLength={16}
          className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-white placeholder-gray-500 font-mono tracking-wider focus:outline-none focus:ring-2 transition-all ${
            error
              ? "border-red-500/60 focus:ring-red-500/50"
              : isValidFormat
              ? "border-green-500/60 focus:ring-green-500/50"
              : "border-white/20 focus:ring-blue-500/50"
          }`}
        />
        <p className="mt-1.5 text-xs text-gray-500">
          Format: SF + 14 characters (e.g.{" "}
          <span className="text-gray-400 font-mono">SF1234567890ABCD</span>)
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/15 border border-red-500/40 rounded-lg text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* QR Code placeholder */}
      <button
        disabled
        className="w-full mb-4 py-2.5 bg-white/5 border border-white/10 text-gray-500 rounded-xl text-sm flex items-center justify-center gap-2 cursor-not-allowed"
      >
        📷 Scan QR Code (Coming Soon)
      </button>

      {/* Connect button */}
      <button
        onClick={handleConnect}
        disabled={loading || !deviceId.trim()}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all active:scale-95 mb-3"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Connecting…
          </span>
        ) : (
          "Connect Device →"
        )}
      </button>

      {/* Back button */}
      <button
        onClick={onBack}
        disabled={loading}
        className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50"
      >
        ← Back
      </button>
    </div>
  );
}

// ─── Step 3 — Name Your Device ────────────────────────────────────────────────

function Step3NameDevice({
  sessionToken,
  deviceId,
  onBack,
}: {
  sessionToken: string;
  deviceId: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    if (!name.trim()) {
      setError("Please give your device a name");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/device/provision", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken,
          deviceId,
          name: name.trim(),
          location: location.trim() || undefined,
        }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.push("/devices");
    } catch {
      setError("Failed to complete setup. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">🏷️</div>
        <h1 className="text-2xl font-bold text-white mb-2">Name Your Device</h1>
        <p className="text-gray-400 text-sm">
          Give it a friendly name so you can find it easily later.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Device Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="Living Room Filter"
            maxLength={50}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Location{" "}
            <span className="text-gray-500 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Basement HVAC"
            maxLength={50}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/15 border border-red-500/40 rounded-lg text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      <button
        onClick={handleFinish}
        disabled={loading || !name.trim()}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all active:scale-95 mb-3"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Finishing setup…
          </span>
        ) : (
          "Finish Setup"
        )}
      </button>

      {/* Back button */}
      <button
        onClick={onBack}
        disabled={loading}
        className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50"
      >
        ← Back
      </button>
    </div>
  );
}

// ─── Page Shell ───────────────────────────────────────────────────────────────

export default function DeviceSetupPage() {
  const [step, setStep] = useState<Step>(1);
  const [sessionToken, setSessionToken] = useState("");
  const [provisionedDeviceId, setProvisionedDeviceId] = useState("");

  const handleStep2Complete = (token: string, devId: string) => {
    setSessionToken(token);
    setProvisionedDeviceId(devId);
    setStep(3);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] flex items-start justify-center p-4 pt-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/devices"
            className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors"
          >
            ← Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <span className="text-white font-semibold text-sm">Add Smart Filter</span>
          </div>
          <div className="w-12" />
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-7 border border-white/10">
          <StepProgress current={step} />

          {step === 1 && <Step1PowerOn onNext={() => setStep(2)} />}
          {step === 2 && (
            <Step2EnterDeviceId
              onNext={handleStep2Complete}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step3NameDevice
              sessionToken={sessionToken}
              deviceId={provisionedDeviceId}
              onBack={() => setStep(2)}
            />
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-4">
          Need help?{" "}
          <a
            href="mailto:support@mysmartfilter.com"
            className="text-gray-500 hover:text-gray-300 underline"
          >
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
