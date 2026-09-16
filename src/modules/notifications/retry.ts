/**
 * Maximum number of delivery attempts allowed for a notification.
 */
export const MAX_NOTIFICATION_ATTEMPTS = 3;

/**
 * Calculates the delay before the next retry using exponential backoff.
 *
 * Attempt 1 → 1 second
 * Attempt 2 → 2 seconds
 * Attempt 3 → 4 seconds
 */
export function getRetryDelay(attemptNumber: number): number {
  const baseDelay = 1000;

  return baseDelay * 2 ** (attemptNumber - 1);
}
