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
