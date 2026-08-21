import { Resend } from "resend";
import { env } from "~/env";

/**
 * Lazy Resend client: `new Resend(undefined)` throws, and Next.js loads route
 * modules during `next build` — builds without RESEND_API_KEY (previews,
 * local) must not crash at import. A missing key throws at first send instead.
 */
let resendClient: Resend | undefined;

function getResendClient(): Resend {
  resendClient ??= new Resend(env.RESEND_API_KEY);
  return resendClient;
}

export const resend: Resend = new Proxy({} as Resend, {
  get(_target, prop) {
    const client = getResendClient();
    const value = Reflect.get(client, prop, client) as unknown;
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});

// Default from address — falls back to noreply@mysmartfilter.com
export const EMAIL_FROM = env.EMAIL_FROM ?? "noreply@mysmartfilter.com";

/** Escape user-controlled text before interpolating it into email HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
