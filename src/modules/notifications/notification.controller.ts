import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../shared/errors/app-error.js";

import { createNotificationSchema } from "./notification.schema.js";
import { createNotification } from "./notification.service.js";

export async function createNotificationController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const idempotencyKey = request.headers["idempotency-key"];

  if (!idempotencyKey || Array.isArray(idempotencyKey)) {
    throw new AppError(
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Key header is required",
      400,
    );
  }

  const input = createNotificationSchema.parse(request.body);

  const notification = await createNotification(input, idempotencyKey);

  return reply.status(202).send({
    id: notification.id,
    status: notification.status,
  });
}
