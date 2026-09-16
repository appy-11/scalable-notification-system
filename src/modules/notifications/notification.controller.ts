/**
 * This is the notification controller module. It is responsible for handling HTTP requests related to notifications.
 * It exposes an endpoint to create notifications, which validates the request, checks for idempotency, and delegates the creation to the notification service.
 * The controller ensures that the request is properly formatted and that the required headers are present before processing the request.
 * It ensures Idempotency by requiring an "Idempotency-Key" header, which is used to prevent duplicate processing of the same request.
 */
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
