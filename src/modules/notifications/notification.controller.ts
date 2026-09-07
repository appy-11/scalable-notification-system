import type { FastifyReply, FastifyRequest } from "fastify";

import { createNotificationSchema } from "./notification.schema.js";
import { createNotification } from "./notification.service.js";

export async function createNotificationController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const input = createNotificationSchema.parse(request.body);

  const notification = await createNotification(input);

  return reply.status(202).send({
    id: notification.id,
    status: notification.status,
  });
}
