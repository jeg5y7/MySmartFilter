import { z } from "zod";
import bcrypt from "bcryptjs";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const userRouter = createTRPCRouter({
  // Get current user information
  getCurrent: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          hasPassword: true,
        },
      });
      
      return user;
    }),

  // Set up password for user
  setupPassword: protectedProcedure
    .input(z.object({
      password: z.string().min(8, "Password must be at least 8 characters long"),
    }))
    .mutation(async ({ ctx, input }) => {
      const hashedPassword = await bcrypt.hash(input.password, 12);
      
      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: {
          password: hashedPassword,
          hasPassword: true,
        },
      });
      
      return { success: true };
    }),
});
