import { type DefaultSession, type NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";

import { db } from "~/server/db";
import { CustomPrismaAdapter } from "./prisma-adapter";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Branded magic-link email (Nordic-light template, matching every other
 * email we send). Replaces NextAuth's default unstyled sign-in mail.
 * The URL is NextAuth-generated; it's attribute-encoded for safety.
 */
function magicLinkEmail(url: string) {
  const safeUrl = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eeebe4;">
    <div style="background:#faf8f5;padding:24px 32px;border-bottom:1px solid #eeebe4;">
      <p style="margin:0;color:#3e8a72;font-size:12px;text-transform:uppercase;letter-spacing:1px;">MySmartFilter</p>
      <h1 style="margin:8px 0 0;color:#1c1b18;font-size:22px;font-weight:700;">Your sign-in link</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#55524a;font-size:15px;margin-top:0;">
        Tap the button below to sign in to your MySmartFilter dashboard.
      </p>
      <p style="margin:24px 0;">
        <a href="${safeUrl}" style="background:#3e8a72;color:#ffffff;border-radius:9999px;padding:12px 24px;font-weight:600;text-decoration:none;display:inline-block;">Sign in</a>
      </p>
      <p style="color:#8a867c;font-size:13px;margin-bottom:0;">
        This link expires in 24 hours and can only be used once. If you
        didn&rsquo;t request it, you can safely ignore this email — your
        account stays untouched.
      </p>
    </div>
  </div>
  <p style="max-width:560px;margin:0 auto 40px;text-align:center;color:#a5a198;font-size:12px;">
    MySmartFilter &middot; know your air, change on time
  </p>
</body>
</html>`;
  const text = `Sign in to MySmartFilter\n\n${url}\n\nThis link expires in 24 hours and can only be used once. If you didn't request it, you can safely ignore this email.`;
  return { html, text };
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    ...(process.env.RESEND_API_KEY ? [
      Resend({
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.EMAIL_FROM ?? "noreply@mysmartfilter.com",
        async sendVerificationRequest({ identifier, url, provider }) {
          const { html, text } = magicLinkEmail(url);
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${provider.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: provider.from,
              to: identifier,
              subject: "Your MySmartFilter sign-in link",
              html,
              text,
            }),
          });
          if (!res.ok) {
            throw new Error(`Magic-link email failed: ${res.status}`);
          }
        },
      })
    ] : []),
  ],
  // Only use database adapter when we have email provider configured
  ...(process.env.RESEND_API_KEY ? { adapter: CustomPrismaAdapter() } : {}),
  pages: {
    signIn: '/signin',
  },
  events: {
    async createUser({ user }) {
      if (user.email) {
        try {
          const { sendWelcomeEmail } = await import("~/lib/welcome-email");
          await sendWelcomeEmail(user.email);
        } catch (error) {
          console.error("Welcome email failed:", error);
        }
      }
    },
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Always redirect to dashboard after successful authentication
      if (url === baseUrl || url === `${baseUrl}/` || url.includes('/auth') || url.includes('/signin')) {
        return `${baseUrl}/dashboard`;
      }
      
      // For callback URLs that are safe and within our domain, use them
      if (url.startsWith(baseUrl)) {
        return url;
      }
      
      // Default fallback to dashboard
      return `${baseUrl}/dashboard`;
    },
    async session({ session, token, user }) {
      // When using database adapter, user object is passed directly
      const userId = user?.id ?? token?.sub ?? session?.user?.id;
      
      if (userId) {
        session.user.id = userId;
      } else if (session?.user?.email) {
        // Fallback: get user ID from database using email
        try {
          const dbUser = await db.user.findUnique({
            where: { email: session.user.email },
            select: { id: true }
          });
          if (dbUser?.id) {
            session.user.id = dbUser.id;
          }
        } catch (error) {
          console.error('Error finding user by email:', error);
        }
      }
      
      return session;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
  },
} satisfies NextAuthConfig;
