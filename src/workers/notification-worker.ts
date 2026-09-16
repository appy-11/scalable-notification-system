/**
 * This is the notification worker module. It is responsible for consuming notification events from Kafka and processing them.
 * It listens to the "notifications" topic and processes "NotificationCreated" events.
 * For each event, it claims the notification for processing and fetches the notification data.
 * If the notification has already been claimed or processed by another worker, it will be ignored.
 */
import "dotenv/config";

import type { EachMessagePayload } from "kafkajs";

import { kafka } from "../infrastructure/kafka/kafka.js";
import { KAFKA_TOPICS } from "../infrastructure/kafka/topics.js";
import { processNotification } from "../modules/notifications/notification.processor.js";

const consumer = kafka.consumer({
  groupId: "notification-worker",
});

async function processMessage({
  topic,
  partition,
  message,
}: EachMessagePayload) {
  const rawValue = message.value?.toString();

  if (!rawValue) {
    console.warn("Received message with empty value");
    return;
  }

  let event;

  try {
    event = JSON.parse(rawValue);
  } catch {
    console.error("Received invalid JSON message", {
      rawValue,
    });

    return;
  }

  console.log("Received notification event", {
    topic,
    partition,
    offset: message.offset,
    event,
  });

  if (event.eventType !== "NotificationCreated") {
    console.log(`Ignoring unsupported event type: ${event.eventType}`);

    return;
  }

  const notificationId = event.payload?.notificationId;

  if (!notificationId) {
    console.error("NotificationCreated event does not contain notificationId");

    return;
  }

  await processNotification(notificationId);
}

async function start() {
  await consumer.connect();

  await consumer.subscribe({
    topic: KAFKA_TOPICS.NOTIFICATIONS,
    fromBeginning: false,
  });

  console.log("Notification worker started");

  await consumer.run({
    eachMessage: processMessage,
  });
}

async function shutdown() {
  console.log("Shutting down notification worker...");

  await consumer.disconnect();

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch((error) => {
  console.error("Notification worker failed", error);
  process.exit(1);
});
