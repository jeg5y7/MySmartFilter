import Link from "next/link";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — MySmartFilter",
};

const EFFECTIVE_DATE = "July 30, 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <Link href="/" className="text-sm text-faint hover:text-ink transition-colors">
          ← MySmartFilter
        </Link>
        <h1 className="font-display text-4xl font-normal tracking-tight mt-4 mb-2">Privacy Policy</h1>
        <p className="text-faint mb-10">Effective {EFFECTIVE_DATE}</p>

        <div className="space-y-8 text-body leading-relaxed [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:mb-3">
          <section>
            <h2>What we collect</h2>
            <p>
              <strong className="text-ink">Account:</strong> your email address and name (if
              you provide one).{" "}
              <strong className="text-ink">Sensor data:</strong> pressure, temperature, and
              optional air-quality readings from your device, with timestamps and a device
              identifier.{" "}
              <strong className="text-ink">System details you enter:</strong> airflow,
              blower type, electricity rate, device location label.{" "}
              <strong className="text-ink">Orders:</strong> what you bought, shipping
              address, and payment status. Card numbers go directly to Stripe and never touch
              our servers.
            </p>
          </section>

          <section>
            <h2>How we use it</h2>
            <p>
              To run the Service: show your dashboard, compute filter-replacement economics,
              send the alerts you've enabled, fulfill orders, and prevent abuse. We do not
              sell your data or use it for third-party advertising.
            </p>
          </section>

          <section>
            <h2>Who we share it with</h2>
            <p>
              Only service providers needed to operate: Stripe (payments), Resend (email),
              Vercel (hosting), and Neon (database) — each bound to process data only on our
              instructions. We disclose data if legally required.
            </p>
          </section>

          <section>
            <h2>Retention and deletion</h2>
            <p>
              Sensor readings are kept while your account is active so your history and
              trends work. Deleting a device deletes its readings; deleting your account
              deletes your personal data, keeping only order records we must retain for tax
              and accounting.
            </p>
          </section>

          <section>
            <h2>Your choices</h2>
            <p>
              You can export your readings (CSV, per device), edit or remove your card and
              address, disable any notification, and delete devices or your whole account —
              all from Settings. For anything else, email{" "}
              <a href="mailto:support@mysmartfilter.com" className="text-sage underline-offset-2 hover:underline hover:text-sage-deep">
                support@mysmartfilter.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2>Security</h2>
            <p>
              Data is encrypted in transit (TLS) and at rest. Devices authenticate with
              unique per-device tokens. Access to production systems is limited to the
              operator of the Service.
            </p>
          </section>

          <section>
            <h2>Changes</h2>
            <p>
              If we materially change this policy we'll email you before the change takes
              effect.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
