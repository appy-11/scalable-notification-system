/**
 * This module implements a retry scheduler for notifications.
 * It finds notifications that are in the "RETRYING" state and whose retry delay has elapsed,
 * and requeues them for processing through Kafka. The scheduler ensures that notifications
 * are only requeued once by atomically updating their status to "PENDING".
 */
import { prisma } from "../../infrastructure/database/prisma.js";

/**
 * Finds notifications whose retry delay has elapsed and
 * creates outbox events to requeue them for processing.
 */
export async function scheduleRetries() {
  const now = new Date();

  const notifications = await prisma.notification.findMany({
    where: {
      status: "RETRYING",
      nextRetryAt: {
        lte: now,
      },
    },
    orderBy: {
      nextRetryAt: "asc",
    },
    take: 100,
  });

  for (const notification of notifications) {
    /**
     * Atomically move the notification back to PENDING and
     * create an outbox event in the same transaction.
     *
     * This ensures that we cannot end up with a PENDING
     * notification without a corresponding Kafka event.
     */
    const result = await prisma.$transaction(async (tx) => {
      const updatedNotification = await tx.notification.updateMany({
        where: {
          id: notification.id,
          status: "RETRYING",
          nextRetryAt: {
            lte: now,
          },
        },
        data: {
          status: "PENDING",
          nextRetryAt: null,
        },
      });

      if (updatedNotification.count === 0) {
        return false;
      }

      await tx.outboxEvent.create({
        data: {
          aggregateType: "Notification",
          aggregateId: notification.id,
          eventType: "NotificationRetry",
          payload: {
            notificationId: notification.id,
          },
        },
      });

      return true;
    });

    if (!result) {
      console.log(`Notification ${notification.id} was already requeued`);

      continue;
    }

    console.log("Notification retry queued", {
      notificationId: notification.id,
      previousRetryAt: notification.nextRetryAt,
    });
  }
}
