import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { db } from "~/server/db";

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
    CredentialsProvider({
      name: "Test Login",
      credentials: {
        email: { 
          label: "Email", 
          type: "email", 
          placeholder: "test@example.com" 
        },
      },
      async authorize(credentials) {
        // For testing - accept any email
        if (credentials?.email && typeof credentials.email === 'string') {
          // Check if user exists
          let user = await db.user.findUnique({
            where: { email: credentials.email }
          });
          
          // Create user if doesn't exist
          if (!user) {
            user = await db.user.create({
              data: {
                email: credentials.email,
                name: credentials.email.split('@')[0], // Use email prefix as name
              }
            });
          }
          
          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        }
        return null;
      },
    }),
  ],
  // Note: Credentials provider doesn't work well with database adapters
  // adapter: PrismaAdapter(db),
  callbacks: {
    async session({ session, token }) {
      if (token?.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
} satisfies NextAuthConfig;
