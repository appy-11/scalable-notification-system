import type { FastifyInstance } from "fastify";

import { createNotificationController } from "./notification.controller.js";

export async function notificationRoutes(app: FastifyInstance) {
  app.post("/api/v1/notifications", createNotificationController);
}
