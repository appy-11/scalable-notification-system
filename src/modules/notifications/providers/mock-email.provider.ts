/**
 * This is a mock implementation of the NotificationProvider interface for sending email notifications.
 * It simulates sending an email by logging the email details to the console and generating a mock provider message ID.
 * This implementation is useful for testing and development purposes, where actual email sending is not required.
 */
import { randomUUID } from "node:crypto";

import type {
  NotificationProvider,
  SendNotificationInput,
  SendNotificationResult,
} from "./notification-provider.js";

export class MockEmailProvider implements NotificationProvider {
  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    const providerMessageId = `mock-email-${randomUUID()}`;

    console.log("Mock email sent", {
      providerMessageId,
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
    });

    return {
      providerMessageId,
    };
  }
}
