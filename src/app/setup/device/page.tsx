"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

// Current monitors: SF + 12 hex (derived from the chip's factory MAC).
// Legacy/pre-pilot units used SF + 14 random characters — accept both.
const DEVICE_ID_REGEX = /^SF[A-Za-z0-9]{12,14}$/i;

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function StepProgress({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: "Power On" },
    { n: 2, label: "Identify" },
    { n: 3, label: "WiFi Setup" },
    { n: 4, label: "Name It" },
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
                    ? "bg-sage text-white"
                    : current === s.n
                    ? "bg-sagemist text-sage-deep ring-2 ring-sage/40"
                    : "bg-mist text-faint"
                }`}
              >
                {current > s.n ? "✓" : s.n}
              </div>
              <span
                className={`mt-1 text-xs whitespace-nowrap ${
                  current === s.n ? "text-sage-deep" : "text-faint"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${
                  current > s.n ? "bg-sage" : "bg-mist"
                }`}
              />
            )}
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-faint">Step {current} of 4</p>
    </div>
  );
}

// ─── Step 1 — Power On ────────────────────────────────────────────────────────

function Step1PowerOn({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-semibold text-ink mb-2">
        Power On Your Device
      </h1>
      <p className="text-body mb-8">
        Plug in your smart filter monitor. Its light will pulse blue when
        it&apos;s ready to set up.
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
        className="w-full py-3 bg-ink hover:bg-ink/85 text-paper font-semibold rounded-full transition-all active:scale-95"
      >
        Next →
      </button>
    </div>
  );
}

// ─── QR Scanner Component ─────────────────────────────────────────────────────

function QRScanner({
  onScan,
  onError,
}: {
  onScan: (result: string) => void;
  onError: (msg: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();

        if (!videoRef.current || !mounted) return;

        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          (result) => {
            if (result && mounted) {
              onScan(result.getText());
            }
            // NotFoundException (no QR in frame) is silently ignored
          },
        );

        if (mounted) {
          controlsRef.current = controls;
        } else {
          controls.stop();
        }
      } catch (err: unknown) {
        if (!mounted) return;
        const error = err as { name?: string; message?: string };
        if (
          error?.name === "NotAllowedError" ||
          error?.message?.includes("Permission") ||
          error?.message?.includes("allowed") ||
          error?.message?.includes("denied")
        ) {
          onError(
            "Camera access was denied. Please allow camera permissions in your browser settings, or enter the ID manually.",
          );
        } else {
          onError(
            "Could not start camera. Please enter the Device ID manually.",
          );
        }
      }
    };

    void startScanner();

    return () => {
      mounted = false;
      if (controlsRef.current) {
        try {
          controlsRef.current.stop();
        } catch {
          // ignore cleanup errors
        }
        controlsRef.current = null;
      }
    };
  }, [onScan, onError]);

  return (
    <div className="relative w-full aspect-square max-w-xs mx-auto rounded-2xl overflow-hidden bg-black/80">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
      />
      {/* Corner bracket scan overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-48 h-48">
          {/* Top-left */}
          <div className="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] border-glow rounded-tl" />
          {/* Top-right */}
          <div className="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] border-glow rounded-tr" />
          {/* Bottom-left */}
          <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] border-glow rounded-bl" />
          {/* Bottom-right */}
          <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] border-glow rounded-br" />
        </div>
      </div>
      <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/60 px-4">
        Point at the QR code on your device
      </p>
    </div>
  );
}

// ─── Step 2 — Identify Device ─────────────────────────────────────────────────

function Step2IdentifyDevice({
  onNext,
  onBack,
}: {
  onNext: (sessionToken: string, deviceId: string) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"qr" | "manual">("qr");
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);

  // QR labels encode mysmartfilter.com/setup/device?device=SF… — prefill the
  // ID so the user just confirms (device may still be booting, so no auto-submit)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = (params.get("device") ?? params.get("id"))
      ?.trim()
      .toUpperCase();
    if (fromUrl && DEVICE_ID_REGEX.test(fromUrl)) {
      setDeviceId(fromUrl);
      setMode("manual");
    }
  }, []);

  const isValidFormat = DEVICE_ID_REGEX.test(deviceId.trim());

  const provision = useCallback(
    async (id: string) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/device/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: id }),
        });

        const data = (await res.json()) as {
          sessionToken?: string;
          error?: string;
        };

        if (!res.ok) {
          setError(
            data.error ?? "Device not found. Check the ID and try again.",
          );
          setScanned(false);
          return;
        }

        if (!data.sessionToken) {
          setError("Unexpected response from server. Please try again.");
          setScanned(false);
          return;
        }

        onNext(data.sessionToken, id);
      } catch {
        setError(
          "Connection failed. Please check your internet and try again.",
        );
        setScanned(false);
      } finally {
        setLoading(false);
      }
    },
    [onNext],
  );

  const handleQRScan = useCallback(
    (result: string) => {
      if (scanned || loading) return;
      const id = result.trim().toUpperCase();
      if (!DEVICE_ID_REGEX.test(id)) return; // ignore non-device QR codes
      setScanned(true);
      setDeviceId(id);
      void provision(id);
    },
    [scanned, loading, provision],
  );

  const handleCameraError = useCallback((msg: string) => {
    setCameraError(msg);
    setMode("manual");
  }, []);

  const handleManualConnect = async () => {
    const trimmed = deviceId.trim().toUpperCase();
    if (!DEVICE_ID_REGEX.test(trimmed)) {
      setError(
        "Device ID must start with SF followed by 12-14 letters/numbers - it's shown on the monitor's setup screen and its label",
      );
      return;
    }
    await provision(trimmed);
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-2">
        Identify Your Device
      </h1>
      <p className="text-body mb-5 text-sm">
        Scan the QR code on your device or enter the Device ID manually.
      </p>

      {/* Mode toggle */}
      <div className="flex rounded-full overflow-hidden border border-mist mb-5">
        <button
          onClick={() => {
            setMode("qr");
            setError("");
            setCameraError("");
          }}
          className={`flex-1 py-2 text-sm font-medium transition-all ${
            mode === "qr"
              ? "bg-ink text-paper"
              : "bg-card text-faint hover:text-ink"
          }`}
        >
          📷 Scan QR Code
        </button>
        <button
          onClick={() => {
            setMode("manual");
            setError("");
          }}
          className={`flex-1 py-2 text-sm font-medium transition-all ${
            mode === "manual"
              ? "bg-ink text-paper"
              : "bg-card text-faint hover:text-ink"
          }`}
        >
          ✏️ Enter Manually
        </button>
      </div>

      {/* Camera error banner */}
      {cameraError && (
        <div className="mb-4 p-3 bg-clay/10 border border-clay/30 rounded-2xl text-clay text-sm">
          📵 {cameraError}
        </div>
      )}

      {/* QR Scanner */}
      {mode === "qr" && !cameraError && (
        <div className="mb-5">
          {loading && scanned ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <span className="inline-block w-8 h-8 border-2 border-mist border-t-sage rounded-full animate-spin" />
              <p className="text-faint text-sm animate-pulse">Connecting to device…</p>
              {deviceId && (
                <p className="text-faint text-xs font-mono">{deviceId}</p>
              )}
            </div>
          ) : (
            <QRScanner onScan={handleQRScan} onError={handleCameraError} />
          )}
        </div>
      )}

      {/* Manual entry */}
      {mode === "manual" && (
        <div className="mb-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-faint mb-2">
            Device ID
          </label>
          <input
            type="text"
            value={deviceId}
            onChange={(e) => {
              setDeviceId(e.target.value);
              setError("");
            }}
            onKeyDown={(e) =>
              e.key === "Enter" && !loading && void handleManualConnect()
            }
            placeholder="SF1234567890ABCD"
            maxLength={16}
            className={`w-full px-4 py-3 bg-card border rounded-full text-sm text-ink placeholder:text-whisper font-mono tracking-wider focus:outline-none focus:ring-2 transition-all ${
              error
                ? "border-red-200 focus:border-red-400 focus:ring-red-500/20"
                : isValidFormat
                  ? "border-sage focus:ring-sage/20"
                  : "border-mist focus:border-sage focus:ring-sage/20"
            }`}
          />
          <p className="mt-1.5 text-xs text-faint">
            Format: SF + 12 characters, as shown on your monitor (e.g.{" "}
            <span className="text-body font-mono">SF44B176A13484</span>)
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Connect button (manual mode only) */}
      {mode === "manual" && (
        <button
          onClick={() => void handleManualConnect()}
          disabled={loading || !deviceId.trim()}
          className="w-full py-3 bg-sage hover:bg-sage-deep disabled:bg-sage/40 disabled:cursor-not-allowed text-white font-semibold rounded-full transition-all active:scale-95 mb-3"
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
      )}

      {/* Back button */}
      <button
        onClick={onBack}
        disabled={loading}
        className="w-full py-2.5 bg-card hover:bg-mist/60 border border-mist text-body hover:text-ink text-sm font-medium rounded-full transition-all disabled:opacity-50"
      >
        ← Back
      </button>
    </div>
  );
}

// ─── Step 3 — Connect to WiFi (Captive Portal) ────────────────────────────────

function Step3ConnectWifi({
  sessionToken,
  deviceId,
  onNext,
  onBack,
}: {
  sessionToken: string;
  deviceId: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [troubleshootOpen, setTroubleshootOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Last 6 chars of device ID as WiFi network name suffix
  const wifiSuffix = deviceId.slice(-6).toUpperCase();

  const checkStatus = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(
        `/api/device/status?deviceId=${encodeURIComponent(deviceId)}`,
        { headers: { Authorization: `Bearer ${sessionToken}` } },
      );
      if (!res.ok) return false;
      const data = (await res.json()) as { status?: string };
      return !!data.status && data.status !== "offline";
    } catch {
      return false;
    }
  }, [deviceId, sessionToken]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setChecking(false);
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return; // already running
    setChecking(true);
    setTimedOut(false);

    pollRef.current = setInterval(() => {
      void checkStatus().then((online) => {
        if (online) {
          stopPolling();
          onNext();
        }
      });
    }, 3000);

    // Timeout after 2 minutes
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setTimedOut(true);
    }, 2 * 60 * 1000);
  }, [checkStatus, onNext, stopPolling]);

  // Auto-start polling on mount
  useEffect(() => {
    startPolling();
    return stopPolling;
  }, [startPolling, stopPolling]);

  const handleManualCheck = async () => {
    stopPolling();
    setChecking(true);
    setTimedOut(false);
    const online = await checkStatus();
    if (online) {
      setChecking(false);
      onNext();
    } else {
      setChecking(false);
      startPolling(); // restart background polling
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-2">
        Connect to Your Device
      </h1>
      <p className="text-body mb-5 text-sm">
        Follow these steps to get your SmartFilter on your home WiFi.
      </p>

      {/* Pulsing green LED animation */}
      <div className="flex justify-center mb-6">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <span className="absolute inline-flex h-full w-full rounded-full bg-sage/20 animate-pulse" />
          <span className="absolute inline-flex h-10 w-10 rounded-full bg-sage/30 animate-pulse" />
          <span className="relative inline-flex rounded-full h-6 w-6 bg-sage animate-pulse" />
        </div>
      </div>

      {/* Step-by-step instructions */}
      <ol className="space-y-3 mb-6">
        {[
          <>Go to your phone or computer&apos;s WiFi settings</>,
          <>
            Connect to the network named{" "}
            <span className="font-mono font-bold text-ink bg-mist px-1.5 py-0.5 rounded text-xs">
              SmartFilter-{wifiSuffix}
            </span>
          </>,
          <>
            A setup page will open automatically — follow the steps to enter
            your home WiFi password
          </>,
          <>
            Come back here when you see the LED turn{" "}
            <span className="text-sage font-medium">solid green</span>
          </>,
        ].map((instruction, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sagemist text-sage-deep text-xs font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span className="text-body text-sm">{instruction}</span>
          </li>
        ))}
      </ol>

      {/* Auto-poll status */}
      {checking && (
        <div className="mb-4 flex items-center gap-2 text-sm text-faint animate-pulse">
          <span className="inline-block w-4 h-4 border-2 border-mist border-t-sage rounded-full animate-spin" />
          Waiting for device to come online…
        </div>
      )}

      {timedOut && (
        <div className="mb-4 p-3 bg-clay/10 border border-clay/30 rounded-2xl text-clay text-sm">
          ⏱ Still waiting — press the button below once your LED is solid green.
        </div>
      )}

      {/* Primary CTA */}
      <button
        onClick={() => void handleManualCheck()}
        disabled={checking}
        className="w-full py-3 bg-sage hover:bg-sage-deep disabled:bg-sage/40 disabled:cursor-not-allowed text-white font-semibold rounded-full transition-all active:scale-95 mb-3"
      >
        {checking ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Checking…
          </span>
        ) : (
          "My device is online ✓"
        )}
      </button>

      {/* Having trouble? accordion */}
      <div className="mb-3 border border-mist rounded-2xl overflow-hidden">
        <button
          onClick={() => setTroubleshootOpen((o) => !o)}
          className="w-full px-4 py-3 flex items-center justify-between text-sm text-body hover:text-ink hover:bg-mist/40 transition-all"
        >
          <span>Having trouble?</span>
          <span className="text-xs">{troubleshootOpen ? "▲" : "▼"}</span>
        </button>
        {troubleshootOpen && (
          <div className="px-4 pb-4 border-t border-mist bg-paper">
            <p className="text-body text-sm pt-3 font-medium mb-2">
              Common fixes:
            </p>
            <ul className="space-y-2 text-sm text-body">
              <li className="flex items-start gap-2">
                <span className="text-sage mt-0.5 flex-shrink-0">•</span>
                Make sure you&apos;re connected to{" "}
                <span className="font-mono text-ink ml-1">
                  SmartFilter-{wifiSuffix}
                </span>
                , not your home network.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sage mt-0.5 flex-shrink-0">•</span>
                No captive portal popup? Try navigating to{" "}
                <span className="font-mono text-sage">192.168.4.1</span> in
                your browser manually.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sage mt-0.5 flex-shrink-0">•</span>
                LED not blinking? Hold the button for 5 seconds to reset the
                device.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sage mt-0.5 flex-shrink-0">•</span>
                Entered the wrong WiFi password? Reconnect to{" "}
                <span className="font-mono text-ink">
                  SmartFilter-{wifiSuffix}
                </span>{" "}
                and try again.
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Back button */}
      <button
        onClick={() => {
          stopPolling();
          onBack();
        }}
        className="w-full py-2.5 bg-card hover:bg-mist/60 border border-mist text-body hover:text-ink text-sm font-medium rounded-full transition-all"
      >
        ← Back
      </button>
    </div>
  );
}

// ─── Step 4 — Name Your Device ────────────────────────────────────────────────

function Step4NameDevice({
  sessionToken,
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
          deviceName: name.trim(),
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
        <h1 className="text-2xl font-semibold text-ink mb-2">
          Name Your Device
        </h1>
        <p className="text-body text-sm">
          Give it a friendly name so you can find it easily later.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-faint mb-2">
            Device Name <span className="text-red-600">*</span>
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
            className="w-full px-4 py-3 bg-card border border-mist rounded-full text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-faint mb-2">
            Location{" "}
            <span className="text-whisper font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Basement HVAC"
            maxLength={50}
            className="w-full px-4 py-3 bg-card border border-mist rounded-full text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      <button
        onClick={() => void handleFinish()}
        disabled={loading || !name.trim()}
        className="w-full py-3 bg-sage hover:bg-sage-deep disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-full transition-all active:scale-95 mb-3"
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

      <button
        onClick={onBack}
        disabled={loading}
        className="w-full py-2.5 bg-card hover:bg-mist/60 border border-mist text-body hover:text-ink text-sm font-medium rounded-full transition-all disabled:opacity-50"
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
    <div className="min-h-screen bg-paper flex items-start justify-center p-4 pt-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/devices"
            className="text-faint hover:text-ink text-sm flex items-center gap-1 transition-colors"
          >
            ← Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <span className="text-ink font-semibold text-sm">
              Add Smart Filter
            </span>
          </div>
          <div className="w-12" />
        </div>

        {/* Card */}
        <div className="rounded-[24px] border border-mist bg-card p-7">
          <StepProgress current={step} />

          {step === 1 && <Step1PowerOn onNext={() => setStep(2)} />}
          {step === 2 && (
            <Step2IdentifyDevice
              onNext={handleStep2Complete}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step3ConnectWifi
              sessionToken={sessionToken}
              deviceId={provisionedDeviceId}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <Step4NameDevice
              sessionToken={sessionToken}
              deviceId={provisionedDeviceId}
              onBack={() => setStep(3)}
            />
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-faint mt-4">
          Need help?{" "}
          <a
            href="mailto:support@mysmartfilter.com"
            className="text-sage underline underline-offset-2 hover:text-sage-deep"
          >
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
