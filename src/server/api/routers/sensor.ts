import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { isAutoShipMember, FREE_HISTORY_WINDOW_MS } from "~/lib/membership";

export const sensorRouter = createTRPCRouter({
  // Ingest happens via POST /api/sensor with device-token auth — no public
  // create mutation here.

  // Get latest readings for a user
  getLatest: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(10),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.sensorReading.findMany({
        where: { userId: ctx.session.user.id },
        orderBy: { timestamp: "desc" },
        take: input.limit,
      });
    }),

  // Get readings by device
  getByDevice: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
      limit: z.number().min(1).max(100).default(50),
      sensorType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.sensorReading.findMany({
        where: { 
          userId: ctx.session.user.id,
          deviceId: input.deviceId,
          ...(input.sensorType && { sensorType: input.sensorType }),
        },
        orderBy: { timestamp: "desc" },
        take: input.limit,
      });
    }),

  // Get readings within a time range.
  // Tier gate (server-side): historical trending is a Filter AutoShip
  // feature — free accounts get the live window only, whatever the client asks.
  getByTimeRange: protectedProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      deviceId: z.string().optional(),
      sensorType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      let startDate = input.startDate;
      const member = await isAutoShipMember(ctx.session.user.id);
      if (!member) {
        const floor = new Date(Date.now() - FREE_HISTORY_WINDOW_MS);
        if (startDate < floor) startDate = floor;
      }
      return ctx.db.sensorReading.findMany({
        where: {
          userId: ctx.session.user.id,
          timestamp: {
            gte: startDate,
            lte: input.endDate,
          },
          ...(input.deviceId && { deviceId: input.deviceId }),
          ...(input.sensorType && { sensorType: input.sensorType }),
        },
        orderBy: { timestamp: "asc" },
      });
    }),

  // Membership flag for tier-aware UI
  getMembership: protectedProcedure.query(async ({ ctx }) => {
    return { autoShip: await isAutoShipMember(ctx.session.user.id) };
  }),

  // List distinct sensor types for a device
  getSensorTypes: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.sensorReading.findMany({
        where: { userId: ctx.session.user.id, deviceId: input.deviceId },
        select: { sensorType: true },
        distinct: ["sensorType"],
      });
      return rows.map((r) => r.sensorType);
    }),

  // Export readings as CSV data
  exportCsv: protectedProcedure
    .input(z.object({
      deviceId: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const MAX_ROWS = 10000;
      const readings = await ctx.db.sensorReading.findMany({
        where: {
          userId: ctx.session.user.id,
          ...(input.deviceId && { deviceId: input.deviceId }),
          ...(input.startDate || input.endDate ? {
            timestamp: {
              ...(input.startDate && { gte: input.startDate }),
              ...(input.endDate && { lte: input.endDate }),
            },
          } : {}),
        },
        orderBy: { timestamp: "asc" },
        take: MAX_ROWS + 1,
        include: { device: { select: { name: true, deviceId: true } } },
      });

      const truncated = readings.length > MAX_ROWS;
      const rows = truncated ? readings.slice(0, MAX_ROWS) : readings;

      return {
        truncated,
        totalRows: rows.length,
        rows: rows.map(r => ({
          timestamp: r.timestamp.toISOString(),
          deviceId: r.device.deviceId,
          deviceName: r.device.name ?? r.device.deviceId,
          pressure: r.pressure,
          temperature: r.temperature,
        })),
      };
    }),

  // Get summary statistics
  getStats: protectedProcedure
    .input(z.object({
      deviceId: z.string().optional(),
      hours: z.number().default(24), // Last 24 hours by default
    }))
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.hours * 60 * 60 * 1000);
      
      const readings = await ctx.db.sensorReading.findMany({
        where: {
          userId: ctx.session.user.id,
          timestamp: { gte: since },
          ...(input.deviceId && { deviceId: input.deviceId }),
        },
      });

      if (readings.length === 0) {
        return null;
      }

      const pressures = readings.map(r => r.pressure);
      const temperatures = readings.map(r => r.temperature);

      return {
        count: readings.length,
        pressure: {
          min: Math.min(...pressures),
          max: Math.max(...pressures),
          avg: pressures.reduce((a, b) => a + b, 0) / pressures.length,
        },
        temperature: {
          min: Math.min(...temperatures),
          max: Math.max(...temperatures),
          avg: temperatures.reduce((a, b) => a + b, 0) / temperatures.length,
        },
        timeRange: {
          start: readings[readings.length - 1]?.timestamp,
          end: readings[0]?.timestamp,
        },
      };
    }),
});
