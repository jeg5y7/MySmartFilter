import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { db } from "~/server/db";

// Create a custom adapter that wraps the Prisma adapter
// This handles the case where deleteSession is called with a non-existent session
export function CustomPrismaAdapter(): Adapter {
  const baseAdapter = PrismaAdapter(db) as Adapter;
  
  return {
    ...baseAdapter,
    // Override deleteSession to handle missing sessions gracefully
    deleteSession: async (sessionToken: string) => {
      try {
        // First check if the session exists
        const session = await db.session.findUnique({
          where: { sessionToken },
        });
        
        // If it doesn't exist, just return null (no error)
        if (!session) {
          console.log(`Session with token ${sessionToken.substring(0, 10)}... not found, skipping delete`);
          return null;
        }
        
        // If it exists, delete it
        const deleted = await db.session.delete({
          where: { sessionToken },
        });
        
        return deleted;
      } catch (error) {
        console.error('Error in deleteSession:', error);
        // Return null instead of throwing to prevent auth flow from breaking
        return null;
      }
    },
  };
}
