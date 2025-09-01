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
    error(error) {
      console.error('[NEXTAUTH ERROR]', error);
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
    async redirect({ url, baseUrl }) {
      console.log('[NEXTAUTH CALLBACK] redirect:', { url, baseUrl });
      // After successful sign in, redirect to dashboard
      if (url.includes('/signin') || url.includes('/auth')) {
        return `${baseUrl}/dashboard`;
      }
      // For other cases, redirect to provided URL or dashboard
      return url.startsWith(baseUrl) ? url : `${baseUrl}/dashboard`;
    },
    async signIn({ user, account, profile }) {
      console.log('[NEXTAUTH CALLBACK] signIn:', {
        user: user?.email,
        provider: account?.provider,
        accountType: account?.type
      });
      return true;
    },
    async session({ session, token, user }) {
      console.log('[NEXTAUTH CALLBACK] session:', {
        userEmail: session?.user?.email,
        sessionUserId: session?.user?.id,
        tokenSub: token?.sub,
        userFromDB: user?.id,
        fullUser: user ? JSON.stringify(user) : null,
        fullToken: JSON.stringify(token),
        fullSession: JSON.stringify(session)
      });
      
      // When using database adapter, user object is passed directly
      // But sometimes the ID might be in different places
      const userId = user?.id || token?.sub || session?.user?.id;
      
      if (userId) {
        console.log('[NEXTAUTH CALLBACK] Setting session.user.id to:', userId);
        session.user.id = userId;
      } else {
        console.error('[NEXTAUTH CALLBACK] No user ID found anywhere!');
        // If no user ID, try to get it from the database using email
        if (session?.user?.email) {
          console.log('[NEXTAUTH CALLBACK] Attempting to find user by email:', session.user.email);
          try {
            const dbUser = await db.user.findUnique({
              where: { email: session.user.email },
              select: { id: true }
            });
            if (dbUser?.id) {
              console.log('[NEXTAUTH CALLBACK] Found user ID from database:', dbUser.id);
              session.user.id = dbUser.id;
            }
          } catch (error) {
            console.error('[NEXTAUTH CALLBACK] Error finding user by email:', error);
          }
        }
      }
      
      return session;
    },
    async jwt({ token, user, account }) {
      console.log('[NEXTAUTH CALLBACK] jwt:', {
        hasUser: !!user,
        hasAccount: !!account,
        tokenSub: token?.sub,
        userEmail: user?.email,
        userId: user?.id,
        tokenEmail: token?.email,
        fullToken: JSON.stringify(token),
        fullUser: user ? JSON.stringify(user) : null
      });
      
      if (user?.id) {
        console.log('[NEXTAUTH CALLBACK] Setting token.sub to:', user.id);
        token.sub = user.id;
      }
      return token;
    },
  },
} satisfies NextAuthConfig;
