/**
 *  This is the notification processor module. It is responsible for processing notifications.
 *  Processing a notification involves claiming it for processing, and
 *  rendering the notification template with the provided data.
 *  The module ensures that only one worker can claim a notification for processing at a time.
 *  If another worker has already claimed the notification, the current worker will not process it.
 *  The module also handles the case where a notification disappears after being claimed, which should not happen under normal circumstances.
 *  The rendered notification is logged for debugging purposes.
 */
import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";

import { MAX_NOTIFICATION_ATTEMPTS } from "./retry.js";
import { ProviderError } from "./providers/provider-error.js";
import { renderTemplate } from "./template-renderer.js";
import { getNotificationProvider } from "./providers/provider.factory.js";

export async function processNotification(notificationId: string) {
  // Atomically claim the notification.
  //why updateMany? Because we want to ensure that only one worker can claim the notification for processing.
  // If another worker has already claimed it, the update will not affect any rows, and we can safely ignore it.
  const claimResult = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      status: "PENDING",
    },
    data: {
      status: "PROCESSING",
    },
  });

  // Another worker already claimed or processed it.
  if (claimResult.count === 0) {
    console.log(
      `Notification ${notificationId} was already claimed or processed`,
    );

    return null;
  }

  // Fetch the notification data for processing.
  const notification = await prisma.notification.findUnique({
    where: {
      id: notificationId,
    },
    include: {
      templateVersionRef: true,
      user: true,
    },
  });

  if (!notification) {
    console.error(
      `Notification ${notificationId} disappeared after being claimed`,
    );

    return null;
  }

  // Record the start time of the processing attempt.
  const startedAt = new Date();

  // Find the next attempt number.
  const lastAttempt = await prisma.notificationAttempt.findFirst({
    where: {
      notificationId: notification.id,
    },
    orderBy: {
      attemptNumber: "desc",
    },
  });

  // Increment the attempt number for the new processing attempt.
  const attemptNumber = (lastAttempt?.attemptNumber ?? 0) + 1;

  // Process the notification by rendering the template and
  // sending it via the appropriate provider.
  try {
    const rendered = renderTemplate(
      notification.templateVersionRef.body,
      notification.templateVersionRef.subject,
      notification.data,
    );

    console.log("Notification rendered", {
      notificationId: notification.id,
      subject: rendered.subject,
      body: rendered.body,
    });

    // Get the appropriate notification provider based on the channel (EMAIL, SMS, or PUSH).
    const provider = getNotificationProvider(notification.channel);

    let recipient: string | null = null;

    switch (notification.channel) {
      case "EMAIL":
        recipient = notification.user.email;
        break;

      case "SMS":
        recipient = notification.user.phone;
        break;

      case "PUSH":
        break;
    }

    if (!recipient) {
      throw new AppError(
        "RECIPIENT_NOT_FOUND",
        `No recipient found for ${notification.channel}`,
        400,
      );
    }

    // Send the notification using the provider and record the result.
    const providerResult = await provider.send({
      recipient,
      subject: rendered.subject,
      body: rendered.body,
    });

    // Record the completion time of the processing attempt.
    const completedAt = new Date();

    // Use a transaction to ensure that both the notification attempt
    // and the notification status update are atomic.
    await prisma.$transaction([
      prisma.notificationAttempt.create({
        data: {
          notificationId: notification.id,
          attemptNumber,
          provider: "mock-email",
          status: "SUCCEEDED",
          providerMessageId: providerResult.providerMessageId,
          startedAt,
          completedAt,
        },
      }),

      prisma.notification.update({
        where: {
          id: notification.id,
        },
        data: {
          status: "SUCCEEDED",
        },
      }),
    ]);

    // Log the successful delivery of the notification for debugging purposes.
    console.log("Notification delivered", {
      notificationId: notification.id,
      attemptNumber,
      providerMessageId: providerResult.providerMessageId,
    });

    return notification;
  } catch (error) {
    console.error("Notification processing failed", {
      notificationId: notification.id,
      attemptNumber,
      error,
    });

    const isProviderError = error instanceof ProviderError;

    const retryable = isProviderError && error.retryable;

    const hasAttemptsRemaining = attemptNumber < MAX_NOTIFICATION_ATTEMPTS;

    // Record the failed attempt and determine the final notification status.
    const nextStatus =
      retryable && hasAttemptsRemaining ? "RETRYING" : "FAILED";

    await prisma.$transaction([
      prisma.notificationAttempt.create({
        data: {
          notificationId: notification.id,
          attemptNumber,
          provider: "mock-email",
          status: nextStatus,
          errorCode: isProviderError ? error.code : "UNKNOWN_ERROR",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown notification processing error",
          startedAt,
          completedAt: new Date(),
        },
      }),

      prisma.notification.update({
        where: {
          id: notification.id,
        },
        data: {
          status: nextStatus,
        },
      }),
    ]);

    console.log("Notification failure recorded", {
      notificationId: notification.id,
      attemptNumber,
      status: nextStatus,
      retryable,
      hasAttemptsRemaining,
    });

    // The Kafka consumer should acknowledge the message after the
    // failure has been persisted. The retry scheduling mechanism
    // will be added in the next step.
    return null;
  }
}
