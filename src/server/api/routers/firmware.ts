import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

/**
 * Firmware tRPC router.
 * Allows admins/authenticated users to manage firmware releases.
 */
export const firmwareRouter = createTRPCRouter({
  /**
   * List all firmware releases, newest first.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.firmwareRelease.findMany({
      orderBy: { createdAt: "desc" },
    });
  }),

  /**
   * Publish a new firmware release.
   * Creates the record and optionally deactivates all previous releases.
   */
  publish: protectedProcedure
    .input(
      z.object({
        version: z.string().min(1), // semver e.g. "1.2.0"
        binaryUrl: z.string().url(),
        releaseNotes: z.string().optional(),
        isActive: z.boolean().default(true),
        deactivatePrevious: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { version, binaryUrl, releaseNotes, isActive, deactivatePrevious } =
        input;

      // Deactivate all previous releases if requested
      if (deactivatePrevious) {
        await ctx.db.firmwareRelease.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }

      const release = await ctx.db.firmwareRelease.create({
        data: {
          version,
          binaryUrl,
          releaseNotes,
          isActive,
        },
      });

      return release;
    }),

  /**
   * Toggle active status for a specific release.
   */
  setActive: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.firmwareRelease.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
    }),
});
