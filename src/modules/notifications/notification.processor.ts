/**
 *  This is the notification processor module. It is responsible for processing notifications.
 *  Processing a notification involves claiming it for processing, and
 *  then returning the notification data for further processing.
 */
import { prisma } from "../../infrastructure/database/prisma.js";

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

  console.log("Notification claimed for processing", {
    notificationId: notification.id,
    userId: notification.userId,
    channel: notification.channel,
    category: notification.category,
    templateVersion: notification.templateVersion,
  });

  return notification;
}
