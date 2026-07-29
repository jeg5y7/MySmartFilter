import { z } from "zod";
import bcrypt from "bcryptjs";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { stripe } from "~/lib/stripe";

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

  // Billing summary: card on file + shipping address (for /settings/billing)
  getBilling: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        stripeDefaultPaymentMethodId: true,
        shippingName: true,
        shippingAddress1: true,
        shippingAddress2: true,
        shippingCity: true,
        shippingState: true,
        shippingZip: true,
        shippingCountry: true,
      },
    });

    let card: { brand: string; last4: string; expMonth: number; expYear: number } | null = null;
    if (user?.stripeDefaultPaymentMethodId) {
      try {
        const pm = await stripe.paymentMethods.retrieve(user.stripeDefaultPaymentMethodId);
        if (pm.card) {
          card = {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          };
        }
      } catch (err) {
        console.error("Could not retrieve payment method:", err);
      }
    }

    return {
      card,
      shipping: user?.shippingAddress1
        ? {
            name: user.shippingName,
            address1: user.shippingAddress1,
            address2: user.shippingAddress2,
            city: user.shippingCity,
            state: user.shippingState,
            zip: user.shippingZip,
            country: user.shippingCountry,
          }
        : null,
    };
  }),

  // Update shipping address on file (used for auto-orders)
  updateShipping: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        address1: z.string().min(1).max(200),
        address2: z.string().max(200).optional(),
        city: z.string().min(1).max(100),
        state: z.string().min(2).max(2),
        zip: z.string().min(5).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: {
          shippingName: input.name,
          shippingAddress1: input.address1,
          shippingAddress2: input.address2 ?? null,
          shippingCity: input.city,
          shippingState: input.state.toUpperCase(),
          shippingZip: input.zip,
          shippingCountry: "US",
        },
      });
      return { success: true };
    }),
});
