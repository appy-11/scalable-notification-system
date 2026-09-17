/**
 * This module implements a retry scheduler for notifications.
 * It finds notifications that are in the "RETRYING" state and whose retry delay has elapsed,
 * and requeues them for processing through Kafka. The scheduler ensures that notifications
 * are only requeued once by atomically updating their status to "PENDING".
 */
import { prisma } from "../../infrastructure/database/prisma.js";
import { kafkaProducer } from "../../infrastructure/kafka/kafka.js";
import { KAFKA_TOPICS } from "../../infrastructure/kafka/topics.js";

/**
 * Finds notifications whose retry delay has elapsed and
 * requeues them for processing through Kafka.
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
     * Atomically move the notification back to PENDING.
     * This prevents multiple scheduler instances from
     * requeueing the same notification.
     */
    const result = await prisma.notification.updateMany({
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

    if (result.count === 0) {
      console.log(`Notification ${notification.id} was already requeued`);

      continue;
    }

    await kafkaProducer.send({
      topic: KAFKA_TOPICS.NOTIFICATIONS,
      messages: [
        {
          key: notification.id,
          value: JSON.stringify({
            eventId: `retry-${notification.id}-${Date.now()}`,
            eventType: "NotificationRetry",
            aggregateType: "Notification",
            aggregateId: notification.id,
            payload: {
              notificationId: notification.id,
            },
            occurredAt: now,
          }),
        },
      ],
    });

    console.log("Notification retry scheduled", {
      notificationId: notification.id,
      nextRetryAt: notification.nextRetryAt,
    });
  }
}
