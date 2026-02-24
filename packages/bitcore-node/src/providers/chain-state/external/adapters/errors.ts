/** Base class for adapter errors. All adapter-thrown errors must extend this. */
export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly providerName: string,
    public readonly affectsHealth: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** Tx/resource not found. Does not affect provider health. May failover for indexing lag. */
export class NotFoundError extends AdapterError {
  constructor(providerName: string, resource: string) {
    super(`${providerName}: ${resource} not found`, providerName, false);
  }
}

/** Bad client input (invalid address, txId format, etc). Does not affect provider health. No failover. */
export class InvalidRequestError extends AdapterError {
  constructor(providerName: string, reason: string) {
    super(`${providerName}: invalid request - ${reason}`, providerName, false);
  }
}

/** API key invalid/expired. Affects provider health, triggers failover. */
export class AuthError extends AdapterError {
  constructor(providerName: string) {
    super(`${providerName}: authentication failed`, providerName, true);
  }
}

/** Rate limited (429). Affects provider health, triggers failover. */
export class RateLimitError extends AdapterError {
  constructor(providerName: string, retryAfterMs?: number) {
    super(`${providerName}: rate limited`, providerName, true);
    this.retryAfterMs = retryAfterMs;
  }
  retryAfterMs?: number;
}

/** Request timed out. Affects provider health, triggers failover. */
export class TimeoutError extends AdapterError {
  constructor(providerName: string, timeoutMs: number) {
    super(`${providerName}: request timed out after ${timeoutMs}ms`, providerName, true);
  }
}

/** Upstream 5xx or other provider failure. Affects provider health, triggers failover. */
export class UpstreamError extends AdapterError {
  constructor(providerName: string, statusCode?: number, detail?: string) {
    super(`${providerName}: upstream error${statusCode ? ` (${statusCode})` : ''}${detail ? `: ${detail}` : ''}`, providerName, true);
  }
}

/**
 * Thrown when all providers are unavailable or returned errors.
 * Route handlers should map this to HTTP 503.
 */
export class AllProvidersUnavailableError extends Error {
  constructor(operation: string, chain: string, network: string) {
    super(`All indexed API providers unavailable for ${operation} on ${chain}:${network}`);
    this.name = 'AllProvidersUnavailableError';
  }
}
