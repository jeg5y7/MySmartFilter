import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { generateApiKey } from "~/lib/api-key";
import { randomBytes } from "crypto";

const WEBHOOK_EVENTS = ["filter.alert", "device.offline", "reading.threshold"] as const;

export const integrationsRouter = createTRPCRouter({
  // ─── API Keys ─────────────────────────────────────────────────────────────

  listApiKeys: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.apiKey.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        key: true,
        lastUsed: true,
        createdAt: true,
      },
    });
  }),

  createApiKey: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const key = generateApiKey();
      const apiKey = await ctx.db.apiKey.create({
        data: {
          userId: ctx.session.user.id,
          name: input.name,
          key,
        },
      });
      return { id: apiKey.id, name: apiKey.name, key: apiKey.key, createdAt: apiKey.createdAt };
    }),

  deleteApiKey: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const apiKey = await ctx.db.apiKey.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });
      if (!apiKey) throw new Error("API key not found");
      await ctx.db.apiKey.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // ─── Webhooks ─────────────────────────────────────────────────────────────

  listWebhooks: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.webhook.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        enabled: true,
        createdAt: true,
        _count: { select: { deliveries: true } },
      },
    });
  }),

  createWebhook: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(64),
        url: z.string().url(),
        events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const secret = randomBytes(32).toString("hex");
      return ctx.db.webhook.create({
        data: {
          userId: ctx.session.user.id,
          name: input.name,
          url: input.url,
          events: input.events,
          secret,
        },
        select: { id: true, name: true, url: true, events: true, secret: true, enabled: true, createdAt: true },
      });
    }),

  updateWebhook: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string().min(1).max(64).optional(),
        url: z.string().url().optional(),
        events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const wh = await ctx.db.webhook.findFirst({
        where: { id, userId: ctx.session.user.id },
      });
      if (!wh) throw new Error("Webhook not found");
      return ctx.db.webhook.update({ where: { id }, data });
    }),

  deleteWebhook: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const wh = await ctx.db.webhook.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });
      if (!wh) throw new Error("Webhook not found");
      await ctx.db.webhook.delete({ where: { id: input.id } });
      return { success: true };
    }),

  getWebhookDeliveries: protectedProcedure
    .input(z.object({ webhookId: z.string().cuid(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      const wh = await ctx.db.webhook.findFirst({
        where: { id: input.webhookId, userId: ctx.session.user.id },
      });
      if (!wh) return [];
      return ctx.db.webhookDelivery.findMany({
        where: { webhookId: input.webhookId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),
});
