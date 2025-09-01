import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

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
    ...(process.env.RESEND_API_KEY ? [
      Resend({
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.EMAIL_FROM ?? "noreply@mysmartfilter.com",
      })
    ] : []),
    // Email and password authentication
    CredentialsProvider({
      id: "email-password",
      name: "Email and Password",
      credentials: {
        email: { 
          label: "Email", 
          type: "email", 
          placeholder: "your@email.com" 
        },
        password: {
          label: "Password",
          type: "password",
          placeholder: "Your password"
        }
      },
      async authorize(credentials) {
        console.log('[NEXTAUTH DEBUG] CredentialsProvider authorize called with:', {
          email: credentials?.email,
          hasPassword: !!credentials?.password
        });
        
        if (!credentials?.email || !credentials?.password) {
          console.log('[NEXTAUTH DEBUG] Missing credentials');
          return null;
        }

        // Find user with password
        const user = await db.user.findUnique({
          where: { 
            email: credentials.email as string,
          }
        });

        console.log('[NEXTAUTH DEBUG] User found:', {
          userExists: !!user,
          hasPassword: !!user?.password,
          userId: user?.id
        });

        if (!user?.password) {
          console.log('[NEXTAUTH DEBUG] User has no password');
          return null;
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(credentials.password as string, user.password);
        
        console.log('[NEXTAUTH DEBUG] Password match:', passwordMatch);
        
        if (!passwordMatch) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  // Only use database adapter when we have email provider configured
  ...(process.env.RESEND_API_KEY ? { adapter: PrismaAdapter(db) } : {}),
  // Temporarily disable custom sign-in page to test magic link
  // pages: {
  //   signIn: '/signin',
  // },
  debug: true,
  logger: {
    error(code, metadata) {
      console.error('[NEXTAUTH ERROR]', code, metadata);
    },
    warn(code) {
      console.warn('[NEXTAUTH WARN]', code);
    },
    debug(code, metadata) {
      console.log('[NEXTAUTH DEBUG]', code, metadata);
    },
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log('[NEXTAUTH EVENT] signIn:', {
        user: user?.email,
        provider: account?.provider,
        isNewUser
      });
    },
    async createUser({ user }) {
      console.log('[NEXTAUTH EVENT] createUser:', user?.email);
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('[NEXTAUTH CALLBACK] signIn:', {
        user: user?.email,
        provider: account?.provider,
        accountType: account?.type
      });
      return true;
    },
    async session({ session, token }) {
      console.log('[NEXTAUTH CALLBACK] session:', {
        userEmail: session?.user?.email,
        tokenSub: token?.sub
      });
      
      if (token?.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      console.log('[NEXTAUTH CALLBACK] jwt:', {
        hasUser: !!user,
        hasAccount: !!account,
        tokenSub: token?.sub,
        userEmail: user?.email
      });
      
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
} satisfies NextAuthConfig;
