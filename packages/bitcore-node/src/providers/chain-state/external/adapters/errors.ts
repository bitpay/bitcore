export enum AdapterErrorCode {
  INVALID_REQUEST = 'INVALID_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  AUTH = 'AUTH',
  RATE_LIMIT = 'RATE_LIMIT',
  TIMEOUT = 'TIMEOUT',
  UPSTREAM = 'UPSTREAM',
}

/**
 * Single error class for all adapter failures.
 * Code determines semantics; affectsHealth is derived from the code.
 */
export class AdapterError extends Error {
  public readonly affectsHealth: boolean;

  constructor(
    public readonly providerName: string,
    public readonly code: AdapterErrorCode,
    detail?: string
  ) {
    super(`${providerName}: ${detail || code}`);
    this.name = 'AdapterError';
    this.affectsHealth = code !== AdapterErrorCode.INVALID_REQUEST && code !== AdapterErrorCode.NOT_FOUND;
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
