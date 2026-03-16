import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { FilterAlert } from "@prisma/client";

export const deviceRouter = createTRPCRouter({
  /**
   * Returns all devices owned by the current user, each with its latest sensor reading.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const devices = await ctx.db.device.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        sensorReadings: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
    });

    return devices.map((device) => ({
      id: device.id,
      deviceId: device.deviceId,
      name: device.name,
      location: device.location,
      type: device.type,
      firmware: device.firmware,
      status: device.status,
      lastSeen: device.lastSeen,
      pressureThreshold: device.pressureThreshold,
      createdAt: device.createdAt,
      latestReading: device.sensorReadings[0] ?? null,
    }));
  }),

  /**
   * Returns the last N alerts for a device, scoped to the current user.
   */
  getAlerts: protectedProcedure
    .input(z.object({ deviceId: z.string(), limit: z.number().default(10) }))
    .query(async ({ ctx, input }): Promise<FilterAlert[]> => {
      // Verify device ownership (deviceId here is the cuid Device.id)
      const device = await ctx.db.device.findFirst({
        where: {
          id: input.deviceId,
          userId: ctx.session.user.id,
        },
      });

      if (!device) return [];

      return ctx.db.filterAlert.findMany({
        where: { deviceId: device.id },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  /**
   * Returns a single device by its cuid id, scoped to the current user.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const device = await ctx.db.device.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          sensorReadings: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
        },
      });

      if (!device) return null;

      return {
        id: device.id,
        deviceId: device.deviceId,
        name: device.name,
        location: device.location,
        type: device.type,
        firmware: device.firmware,
        status: device.status,
        lastSeen: device.lastSeen,
        pressureThreshold: device.pressureThreshold,
        createdAt: device.createdAt,
        latestReading: device.sensorReadings[0] ?? null,
      };
    }),
});
