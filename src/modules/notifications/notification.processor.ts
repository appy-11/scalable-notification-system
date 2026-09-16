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
import { renderTemplate } from "./template-renderer.js";

export async function processNotification(notificationId: string) {
  // Atomically claim the notification.
  //why updateMany? Because we want to ensure that only one worker can claim the notification for processing.
  // If another worker has already claimed it, the update will not affect any rows, and we can safely ignore it.
  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      status: "PENDING",
    },
    data: {
      status: "PROCESSING",
    },
  });

  // Another worker already claimed or processed it.
  if (result.count === 0) {
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

  // Render the notification template with the provided data.
  const rendered = renderTemplate(
    notification.templateVersionRef.body,
    notification.templateVersionRef.subject,
    notification.data,
  );

  console.log("Notification rendered", {
    notificationId: notification.id,
    channel: notification.channel,
    subject: rendered.subject,
    body: rendered.body,
  });

  return {
    notification,
    rendered,
  };
}
