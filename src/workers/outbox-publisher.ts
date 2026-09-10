import "dotenv/config";

import { kafkaProducer } from "../infrastructure/kafka/kafka.js";
import { publishOutboxEvents } from "../modules/outbox/outbox.publisher.js";

async function start() {
  await kafkaProducer.connect();

  console.log("Outbox publisher started");

  const run = async () => {
    try {
      await publishOutboxEvents();
    } catch (error) {
      console.error("Failed to publish outbox events", error);
    }
  };

  await run();

  setInterval(run, 1000);
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
