import "dotenv/config";

import { kafka, kafkaProducer } from "../infrastructure/kafka/kafka.js";
import { KAFKA_TOPICS } from "../infrastructure/kafka/topics.js";

const event = {
  eventId: "bb9b707c-acce-4817-a8b7-ddadf0ee39cf",
  eventType: "NotificationCreated",
  aggregateType: "Notification",
  aggregateId: "d145f672-b53a-4a3f-8c4c-383cc46eea49",
  payload: {
    notificationId: "d145f672-b53a-4a3f-8c4c-383cc46eea49",
    userId: "da39afbb-6fc3-4dd2-9c3c-7d20d6cdd5fa",
    channel: "EMAIL",
    category: "TRANSACTIONAL",
  },
  occurredAt: new Date().toISOString(),
};

async function start() {
  await kafkaProducer.connect();

  await kafkaProducer.send({
    topic: KAFKA_TOPICS.NOTIFICATIONS,
    messages: [
      {
        key: event.aggregateId,
        value: JSON.stringify(event),
      },
    ],
  });

  console.log("Duplicate event published");

  await kafkaProducer.disconnect();
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
