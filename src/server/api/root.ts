import { postRouter } from "~/server/api/routers/post";
import { sensorRouter } from "~/server/api/routers/sensor";
import { userRouter } from "~/server/api/routers/user";
import { deviceRouter } from "~/server/api/routers/device";
import { firmwareRouter } from "~/server/api/routers/firmware";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  sensor: sensorRouter,
  user: userRouter,
  device: deviceRouter,
  firmware: firmwareRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
