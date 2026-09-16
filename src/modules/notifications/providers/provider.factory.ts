/**
 * This module provides a factory function to obtain the appropriate notification provider based on the specified channel (EMAIL, SMS, or PUSH).
 * Currently, only the EMAIL channel is implemented using a mock provider.
 * The SMS and PUSH channels are not yet implemented and will throw an error if requested.
 * The factory function ensures that the correct provider is returned for the specified channel,
 * allowing for easy extension in the future as new providers are added.
 */
import { AppError } from "../../../shared/errors/app-error.js";
import { MockEmailProvider } from "./mock-email.provider.js";
import type { NotificationProvider } from "./notification-provider.js";

const emailProvider = new MockEmailProvider();

export function getNotificationProvider(
  channel: "EMAIL" | "SMS" | "PUSH",
): NotificationProvider {
  switch (channel) {
    case "EMAIL":
      return emailProvider;

    case "SMS":
    case "PUSH":
      throw new AppError(
        "PROVIDER_NOT_IMPLEMENTED",
        `Provider for ${channel} is not implemented`,
        501,
      );

    default:
      throw new AppError(
        "UNSUPPORTED_CHANNEL",
        `Unsupported notification channel: ${channel}`,
        400,
      );
  }
}
