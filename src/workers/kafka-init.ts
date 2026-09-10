import "dotenv/config";

import { kafka } from "../infrastructure/kafka/kafka.js";
import { KAFKA_TOPICS } from "../infrastructure/kafka/topics.js";

async function start() {
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

  console.log("Kafka initialized");
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
