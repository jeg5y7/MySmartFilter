import { Resend } from "resend";
import { env } from "~/env";

// Singleton Resend client
export const resend = new Resend(env.RESEND_API_KEY);

// Default from address — falls back to noreply@mysmartfilter.com
export const EMAIL_FROM = env.EMAIL_FROM ?? "noreply@mysmartfilter.com";
