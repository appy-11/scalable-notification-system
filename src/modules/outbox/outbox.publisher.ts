import { prisma } from "../../infrastructure/database/prisma.js";
import { kafkaProducer } from "../../infrastructure/kafka/kafka.js";
import { KAFKA_TOPICS } from "../../infrastructure/kafka/topics.js";

export async function publishOutboxEvents() {
  const events = await prisma.outboxEvent.findMany({
    where: {
      publishedAt: null,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 100,
  });

  for (const event of events) {
    await kafkaProducer.send({
      topic: KAFKA_TOPICS.NOTIFICATIONS,
      messages: [
        {
          key: event.aggregateId,
          value: JSON.stringify({
            eventId: event.id,
            eventType: event.eventType,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            payload: event.payload,
            occurredAt: event.createdAt,
          }),
        },
      ],
    });

    await prisma.outboxEvent.update({
      where: {
        id: event.id,
      },
      data: {
        publishedAt: new Date(),
      },
    });
  }
}
