import { kafka } from "./kafka.js";
import { KAFKA_TOPICS } from "./topics.js";

export async function initializeKafka() {
  const admin = kafka.admin();

  await admin.connect();

  await admin.createTopics({
    waitForLeaders: true,
    topics: [
      {
        topic: KAFKA_TOPICS.NOTIFICATIONS,
        numPartitions: 3,
        replicationFactor: 1,
      },
    ],
  });

  await admin.disconnect();
}
