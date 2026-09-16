/**
 * Represents an error returned by a notification provider.
 * The retryable flag determines whether the notification
 * should be attempted again.
 */
export class ProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
