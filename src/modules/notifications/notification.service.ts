import { prisma } from "../../infrastructure/database/prisma.js";
import type { CreateNotificationInput } from "./notification.schema.js";

export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.$transaction(async (tx) => {
    const createdNotification = await tx.notification.create({
      data: {
        userId: input.userId,
        channel: input.channel,
        category: input.category,
        templateId: input.templateId,
        templateVersion: input.templateVersion,
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
