import Fastify from "fastify";
import { prisma } from "../infrastructure/database/prisma.js";
import { notificationRoutes } from "../modules/notifications/notification.routes.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.get("/health", async () => {
    return {
      status: "ok",
    };
  });

  app.get("/health/db", async () => {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "ok",
      database: "connected",
    };
  });

  app.register(notificationRoutes);

  return app;
}
