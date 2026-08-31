import Link from "next/link";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — MySmartFilter",
};

const EFFECTIVE_DATE = "July 30, 2026";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <Link href="/" className="text-sm text-faint hover:text-ink transition-colors">
          ← MySmartFilter
        </Link>
        <h1 className="font-display text-4xl font-normal tracking-tight mt-4 mb-2">Terms of Service</h1>
        <p className="text-faint mb-10">Effective {EFFECTIVE_DATE}</p>

        <div className="space-y-8 text-body leading-relaxed [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:mb-3">
          <section>
            <h2>1. What we provide</h2>

            <p>
              MySmartFilter ("we", "us") provides a hardware pressure sensor, a monitoring
              dashboard, alerting, and an optional automatic filter-replacement ordering service
              ("Filter AutoShip"; together, the "Service"). By creating an account or installing
              a device you agree to these terms. Live sensor readings and smart-home access are
              included with every monitor; certain software features — including energy-savings
              calculations, historical trending, and advanced diagnostics — are included with
              active Filter AutoShip enrollment and may be unavailable otherwise.
            </p>
          </section>

          <section>
            <h2>2. Your account</h2>
            <p>
              You're responsible for the accuracy of the information on your account, for
              keeping access to your sign-in email secure, and for all activity under your
              account. You must be 18 or older and able to enter a contract.
            </p>
          </section>

          <section>
            <h2>3. Auto-ordering and payments</h2>
            <p>
              If you enable auto-ordering, you authorize us to charge your saved payment method
              for a replacement filter (at the price shown in your filter preferences, plus
              shipping shown at setup) when your device's readings meet the replacement
              threshold. We email you before each auto-order with a one-click cancellation
              link and wait at least 24 hours before charging. You can disable auto-ordering,
              change your preferred filter, or remove your card at any time in Settings.
              Payments are processed by Stripe; we do not store card numbers.
            </p>
          </section>

          <section>
            <h2>4. Shipping and returns</h2>
            <p>
              Filters ship to the address on file. Unopened filters may be returned within 30
              days of delivery for a refund of the purchase price; contact
              support@mysmartfilter.com. Damaged or incorrect items are replaced at no cost.
            </p>
          </section>

          <section>
            <h2>5. The device and estimates</h2>
            <p>
              Energy-cost figures shown by the Service are estimates derived from your
              device's pressure readings and the system details you provide (airflow, blower
              type, electricity rate). They are provided for guidance and are not a utility
              bill, a warranty of savings, or professional HVAC advice. The device is a
              monitoring accessory: it does not control your HVAC equipment, and it is not a
              substitute for professional maintenance or safety inspections.
            </p>
          </section>

          <section>
            <h2>6. Acceptable use</h2>
            <p>
              Don't attempt to access other users' data, probe or overload the Service,
              resell API access, or use the Service in violation of law. We may suspend
              accounts that do.
            </p>
          </section>

          <section>
            <h2>7. Warranty and liability</h2>
            <p>
              Hardware is covered by a 1-year limited warranty against defects. Otherwise the
              Service is provided "as is" to the maximum extent permitted by law; we disclaim
              implied warranties and are not liable for indirect or consequential damages,
              including damage to HVAC equipment or property. Our total liability is limited
              to the amounts you paid us in the 12 months before the claim.
            </p>
          </section>

          <section>
            <h2>8. Changes and termination</h2>
            <p>
              You can delete your account at any time in Settings, which stops all monitoring
              and auto-ordering. We may update these terms; if the changes are material we'll
              email you at least 14 days before they take effect.
            </p>
          </section>

          <section>
            <h2>9. Contact</h2>
            <p>
              Questions? Email{" "}
              <a href="mailto:support@mysmartfilter.com" className="text-sage underline-offset-2 hover:underline hover:text-sage-deep">
                support@mysmartfilter.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
