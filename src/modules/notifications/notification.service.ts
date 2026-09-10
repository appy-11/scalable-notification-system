import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { hashObject } from "../../shared/utils/hash.js";
import type { Prisma } from "../../generated/prisma/client.js";

import type { CreateNotificationInput } from "./notification.schema.js";

export async function createNotification(
  input: CreateNotificationInput,
  idempotencyKey: string,
) {
  const requestHash = hashObject(input);

  /*
   * Check whether this idempotency key was already used.
   */
  const existing = await prisma.idempotencyRecord.findUnique({
    where: {
      key: idempotencyKey,
    },
  });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new AppError(
        "IDEMPOTENCY_KEY_REUSED",
        "Idempotency-Key was already used with a different request",
        409,
      );
    }

    const existingNotification = await prisma.notification.findUnique({
      where: {
        id: existing.notificationId,
      },
    });

    if (!existingNotification) {
      throw new AppError(
        "IDEMPOTENCY_RECORD_INVALID",
        "Idempotency record references a missing notification",
        500,
      );
    }

    return existingNotification;
  }

  /*
   * Business validation.
   */

  /**
   * Validate scheduled time.
   */
  if (input.scheduledAt && input.scheduledAt <= new Date()) {
    throw new AppError(
      "INVALID_SCHEDULE",
      "scheduledAt must be in the future",
      400,
    );
  }

  /*
   * 2. Validate user.
   */
  const user = await prisma.user.findUnique({
    where: {
      id: input.userId,
    },
  });

  if (!user) {
    throw new AppError("USER_NOT_FOUND", "User does not exist", 404);
  }

  /*
   * 3. Validate template.
   */
  const template = await prisma.template.findUnique({
    where: {
      id: input.templateId,
    },
  });

  if (!template) {
    throw new AppError("TEMPLATE_NOT_FOUND", "Template does not exist", 404);
  }

  /*
   * 4. Ensure the requested channel matches the template.
   */
  if (template.channel !== input.channel) {
    throw new AppError(
      "TEMPLATE_CHANNEL_MISMATCH",
      "Notification channel does not match the template channel",
      400,
    );
  }

  /*
   * 5. Ensure the requested category matches the template.
   */
  if (template.category !== input.category) {
    throw new AppError(
      "TEMPLATE_CATEGORY_MISMATCH",
      "Notification category does not match the template category",
      400,
    );
  }

  /*
   * 6. Validate template version.
   */
  const templateVersion = await prisma.templateVersion.findUnique({
    where: {
      templateId_version: {
        templateId: input.templateId,
        version: input.templateVersion,
      },
    },
  });

  if (!templateVersion) {
    throw new AppError(
      "TEMPLATE_VERSION_NOT_FOUND",
      "Template version does not exist",
      404,
    );
  }

  /*
   * 7. Check notification preference.
   *
   * No preference row means the default is enabled.
   */
  const preference = await prisma.notificationPreference.findUnique({
    where: {
      userId_category_channel: {
        userId: input.userId,
        category: input.category,
        channel: input.channel,
      },
    },
  });

  if (preference && !preference.enabled) {
    throw new AppError(
      "NOTIFICATION_DISABLED",
      "User has disabled this notification type",
      403,
    );
  }

  /*
   * Critical transaction:
   *
   * IdempotencyRecord
   * Notification
   * OutboxEvent
   *
   * all commit together.
   */
  try {
    const notification = await prisma.$transaction(async (tx) => {
      const createdNotification = await tx.notification.create({
        data: {
          userId: input.userId,
          channel: input.channel,
          category: input.category,
          templateId: input.templateId,
          templateVersion: input.templateVersion,
          data: input.data as Prisma.InputJsonObject,
          priority: input.priority,
          scheduledAt: input.scheduledAt ?? null,
          status: "PENDING",
        },
      });

      await tx.idempotencyRecord.create({
        data: {
          key: idempotencyKey,
          requestHash,
          notificationId: createdNotification.id,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: "Notification",
          aggregateId: createdNotification.id,
          eventType: "NotificationCreated",
          payload: {
            notificationId: createdNotification.id,
            userId: createdNotification.userId,
            channel: createdNotification.channel,
            category: createdNotification.category,
          },
        },
      });

      return createdNotification;
    });

    return notification;
  } catch (error) {
    /*
     * Another request may have won the race and inserted
     * the same idempotency key.
     *
     * We'll handle the exact Prisma error more cleanly later.
     */
    throw error;
  }
}
