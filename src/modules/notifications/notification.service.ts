import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { Prisma } from "../../generated/prisma/client.js";

import type { CreateNotificationInput } from "./notification.schema.js";

export async function createNotification(input: CreateNotificationInput) {
  /*
   * 1. Validate scheduled time.
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
   * 8. Create Notification + OutboxEvent atomically.
   */
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
}
