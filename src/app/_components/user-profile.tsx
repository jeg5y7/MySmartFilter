"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

export function UserProfile() {
  const [copied, setCopied] = useState(false);
  const { data: user } = api.user.getCurrent.useQuery();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  if (!user) {
    return (
      <div className="rounded-xl bg-white/10 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">ESP32 Configuration</h3>
        <p className="text-white/60">Sign in to get your ESP32 configuration details</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white/10 p-6">
      <h3 className="text-xl font-semibold text-white mb-4">ESP32 Configuration</h3>
      
      <div className="space-y-4">
        {/* User Information */}
        <div>
          <label className="block text-sm text-white/70 mb-2">User Information</label>
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-white"><strong>Email:</strong> {user.email}</p>
            <p className="text-white"><strong>Name:</strong> {user.name || 'Not set'}</p>
          </div>
        </div>

        {/* User ID for ESP32 */}
        <div>
          <label className="block text-sm text-white/70 mb-2">
            User ID (for ESP32 Arduino code)
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={user.id}
              readOnly
              className="flex-1 rounded-lg bg-white/5 border border-white/20 px-3 py-2 text-white font-mono text-sm"
            />
            <button
              onClick={() => copyToClipboard(user.id)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-white/50 mt-1">
            Use this ID in your ESP32 Arduino code's userId variable
          </p>
        </div>

        {/* Arduino Code Snippet */}
        <div>
          <label className="block text-sm text-white/70 mb-2">Arduino Code Configuration</label>
          <div className="rounded-lg bg-black/30 p-4 font-mono text-sm overflow-x-auto">
            <pre className="text-green-400">
{`// Update these lines in your ESP32 code:
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* userId = "${user.id}";
const char* deviceId = "ESP32_SDP810_001"; // Customize this`}
            </pre>
          </div>
        </div>

        {/* API Endpoints */}
        <div>
          <label className="block text-sm text-white/70 mb-2">API Endpoints</label>
          <div className="space-y-2">
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-white/60">POST (Send sensor data)</p>
              <code className="text-sm text-blue-300">https://mysmartfilter.com/api/sensor</code>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-white/60">GET (View your data)</p>
              <code className="text-sm text-blue-300">https://mysmartfilter.com/api/sensor?userId={user.id}</code>
            </div>
          </div>
        </div>

        {/* Quick Test Button */}
        <div>
          <label className="block text-sm text-white/70 mb-2">Test Configuration</label>
          <button
            onClick={() => {
              const testUrl = `https://mysmartfilter.com/api/sensor?userId=${user.id}&limit=5`;
              window.open(testUrl, '_blank');
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
          >
            🧪 Test API Endpoint
          </button>
          <p className="text-xs text-white/50 mt-1">
            Opens your sensor data API in a new tab
          </p>
        </div>
      </div>
    </div>
  );
}
