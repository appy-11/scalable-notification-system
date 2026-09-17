/**
 *  This is the retry scheduler module. It is responsible for scheduling retries for notifications that have failed to be processed.
 *  The scheduler runs in a loop, checking for notifications that are in the "RETRYING" state and whose retry delay has elapsed.
 *  It requeues these notifications for processing through Kafka, ensuring that they are only requeued once by atomically updating their status to "PENDING".
 */
import "dotenv/config";

import { kafkaProducer } from "../infrastructure/kafka/kafka.js";
import { scheduleRetries } from "../modules/notifications/retry.scheduler.js";

const RETRY_INTERVAL_MS = 1000;

async function start() {
  await kafkaProducer.connect();

  console.log("Retry scheduler started");

  const run = async () => {
    try {
      await scheduleRetries();
    } catch (error) {
      console.error("Failed to schedule notification retries", error);
    }
  };

  await run();

  setInterval(run, RETRY_INTERVAL_MS);
}

async function shutdown() {
  console.log("Shutting down retry scheduler...");

  await kafkaProducer.disconnect();

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch((error) => {
  console.error("Retry scheduler failed", error);
  process.exit(1);
});
