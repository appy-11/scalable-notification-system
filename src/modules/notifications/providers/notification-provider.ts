/**
 * Interface for the input parameters required to send a notification.
 */
export interface SendNotificationInput {
  recipient: string;
  subject: string | null;
  body: string;
}

/**
 * Interface for the result returned after sending a notification.
 */
export interface SendNotificationResult {
  providerMessageId: string;
}

/**
 * Interface for a notification provider that can send notifications.
 * Implementations of this interface should handle the actual sending of notifications
 * through various channels (e.g., email, SMS, push notifications).
 */
export interface NotificationProvider {
  send(input: SendNotificationInput): Promise<SendNotificationResult>;
}
