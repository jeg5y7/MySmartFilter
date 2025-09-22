"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

function DeviceSetupContent() {
  const searchParams = useSearchParams();
  const deviceId = searchParams.get("id");
  const router = useRouter();
  const { data: session, status } = useSession();
  
  const [step, setStep] = useState<"authenticate" | "name" | "linking" | "complete">("authenticate");
  const [deviceName, setDeviceName] = useState("");
  const [location, setLocation] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState("");
  const [linkedDevice, setLinkedDevice] = useState<any>(null);

  useEffect(() => {
    if (status === "authenticated" && step === "authenticate") {
      setStep("name");
    }
  }, [status, step]);

  const handleLinkDevice = async () => {
    if (!deviceName.trim()) {
      setError("Please enter a device name");
      return;
    }

    setIsLinking(true);
    setError("");

    try {
      const response = await fetch("/api/device/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId,
          name: deviceName,
          location: location || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setLinkedDevice(data.device);
        setStep("complete");
      } else {
        setError(data.error || "Failed to link device");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLinking(false);
    }
  };

  if (!deviceId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-4">Invalid Setup Link</h1>
          <p className="text-gray-300 mb-6">
            Please scan the QR code on your Smart Filter device or check the setup link.
          </p>
          <Link 
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full">
        {/* Progress indicator */}
        <div className="flex justify-between mb-8">
          <div className={`flex-1 h-2 rounded-full mr-2 ${step === "authenticate" ? "bg-blue-500" : "bg-green-500"}`} />
          <div className={`flex-1 h-2 rounded-full mr-2 ${step === "name" || step === "linking" ? "bg-blue-500" : step === "complete" ? "bg-green-500" : "bg-gray-600"}`} />
          <div className={`flex-1 h-2 rounded-full ${step === "complete" ? "bg-green-500" : "bg-gray-600"}`} />
        </div>

        {/* Step 1: Authenticate */}
        {step === "authenticate" && status === "loading" && (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <p className="text-white">Checking authentication...</p>
          </div>
        )}

        {step === "authenticate" && status === "unauthenticated" && (
          <>
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🔐</div>
              <h1 className="text-3xl font-bold text-white mb-2">Sign In Required</h1>
              <p className="text-gray-300">
                Sign in to link your Smart Filter to your account
              </p>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-300">
                <strong>Device ID:</strong>
                <span className="font-mono ml-2 text-blue-400">{deviceId}</span>
              </p>
            </div>

            <Link
              href={`/api/auth/signin?callbackUrl=/setup/device?id=${deviceId}`}
              className="block w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium text-center rounded-lg transition-all"
            >
              Sign In to Continue
            </Link>
            
            <p className="text-center text-gray-400 text-sm mt-4">
              Don't have an account? You'll be able to create one.
            </p>
          </>
        )}

        {/* Step 2: Name the device */}
        {step === "name" && (
          <>
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">📝</div>
              <h1 className="text-3xl font-bold text-white mb-2">Name Your Filter</h1>
              <p className="text-gray-300">
                Give your Smart Filter a friendly name
              </p>
            </div>

            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-300">
                <strong>Device ID:</strong>
                <span className="font-mono ml-2 text-blue-400">{deviceId}</span>
              </p>
              <p className="text-sm text-gray-300 mt-1">
                <strong>User:</strong>
                <span className="ml-2 text-blue-400">{session?.user?.email}</span>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Device Name *
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g., Kitchen Filter, Main HVAC"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={50}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Location (optional)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Basement, 2nd Floor"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={50}
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleLinkDevice}
              disabled={isLinking || !deviceName.trim()}
              className="w-full mt-6 py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLinking ? "Linking Device..." : "Link Device to My Account"}
            </button>
          </>
        )}

        {/* Step 3: Linking */}
        {step === "linking" && (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <h2 className="text-2xl font-bold text-white mb-2">Linking Device</h2>
            <p className="text-gray-300">Please wait while we link your Smart Filter...</p>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === "complete" && linkedDevice && (
          <>
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">✅</div>
              <h1 className="text-3xl font-bold text-white mb-2">Setup Complete!</h1>
              <p className="text-gray-300">
                Your Smart Filter is now linked to your account
              </p>
            </div>

            <div className="bg-white/5 rounded-lg p-4 mb-6 space-y-2">
              <p className="text-sm text-gray-300">
                <strong>Device Name:</strong>
                <span className="ml-2 text-blue-400">{linkedDevice.name}</span>
              </p>
              <p className="text-sm text-gray-300">
                <strong>Device ID:</strong>
                <span className="font-mono ml-2 text-blue-400">{linkedDevice.deviceId}</span>
              </p>
              {linkedDevice.location && (
                <p className="text-sm text-gray-300">
                  <strong>Location:</strong>
                  <span className="ml-2 text-blue-400">{linkedDevice.location}</span>
                </p>
              )}
              <p className="text-sm text-gray-300">
                <strong>Status:</strong>
                <span className="ml-2 text-green-400">Ready to monitor</span>
              </p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-300">
                <strong>Next Step:</strong> Your Smart Filter will automatically start sending data. 
                You can view real-time readings and analytics in your dashboard.
              </p>
            </div>

            <div className="space-y-3">
              <Link
                href="/dashboard"
                className="block w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium text-center rounded-lg transition-all"
              >
                Go to Dashboard
              </Link>
              
              <button
                onClick={() => {
                  setStep("name");
                  setDeviceName("");
                  setLocation("");
                  setLinkedDevice(null);
                }}
                className="block w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-medium text-center rounded-lg transition-all"
              >
                Add Another Device
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function DeviceSetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    }>
      <DeviceSetupContent />
    </Suspense>
  );
}
