import { prisma } from "../../infrastructure/database/prisma.js";

import { processNotification } from "./notification.processor.js";

/**
 * Processes a notification event from Kafka.
 *
 * Processed events are stored in PostgreSQL so duplicate Kafka
 * deliveries can be detected and safely ignored.
 */
export async function processNotificationEvent(event: {
  eventId: string;
  eventType: string;
  aggregateId: string;
  payload: {
    notificationId?: string;
  };
}) {
  const existingEvent = await prisma.processedEvent.findUnique({
    where: {
      eventId: event.eventId,
    },
  });

  if (existingEvent) {
    console.log("Duplicate Kafka event ignored", {
      eventId: event.eventId,
      eventType: event.eventType,
    });

    return;
  }

  if (
    event.eventType !== "NotificationCreated" &&
    event.eventType !== "NotificationRetry"
  ) {
    console.log(`Ignoring unsupported event type: ${event.eventType}`);

    return;
  }

  const notificationId = event.payload?.notificationId;

  if (!notificationId) {
    console.error("Notification event does not contain notificationId", {
      eventId: event.eventId,
    });

    return;
  }

  await processNotification(notificationId);

  /**
   * Record the event only after notification processing has
   * completed successfully from the application's perspective.
   *
   * If processing throws, the event is not marked as processed
   * and Kafka can deliver it again.
   */
  try {
    await prisma.processedEvent.create({
      data: {
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
      },
    });
  } catch (error) {
    console.error("Failed to record processed event", {
      eventId: event.eventId,
      error,
    });

    throw error;
  }
}
