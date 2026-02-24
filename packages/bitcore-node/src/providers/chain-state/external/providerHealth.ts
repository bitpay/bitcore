import logger from '../../../logger';

export interface ProviderHealthConfig {
  failureThreshold: number; // Skip provider after N consecutive failures (default: 5)
  cooldownMs: number;       // Try again after this many ms (default: 60000)
}

const DEFAULTS: ProviderHealthConfig = {
  failureThreshold: 5,
  cooldownMs: 60000
};

/**
 * Tracks consecutive failures per provider and skips unhealthy providers
 * until a cooldown period elapses.
 */
export class ProviderHealth {
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private config: ProviderHealthConfig;
  readonly key: string;

  constructor(
    providerName: string,
    config?: Partial<ProviderHealthConfig>,
    keyParts?: { chain: string; network: string }
  ) {
    this.config = { ...DEFAULTS, ...config };
    this.key = keyParts
      ? `${keyParts.chain}:${keyParts.network}:${providerName}`
      : providerName;
  }

  /** Can we send a request to this provider? */
  isAvailable(): boolean {
    if (this.consecutiveFailures < this.config.failureThreshold) return true;
    // Over threshold — check if cooldown has elapsed
    const elapsed = Date.now() - this.lastFailureTime;
    if (elapsed >= this.config.cooldownMs) {
      // Cooldown elapsed — allow one retry (reset failures so it gets one shot)
      logger.info(`ProviderHealth [${this.key}]: cooldown elapsed, retrying`);
      this.consecutiveFailures = this.config.failureThreshold - 1;
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    if (this.consecutiveFailures > 0) {
      logger.info(`ProviderHealth [${this.key}]: recovered after ${this.consecutiveFailures} failures`);
    }
    this.consecutiveFailures = 0;
  }

  recordFailure(error: Error): void {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    if (this.consecutiveFailures >= this.config.failureThreshold) {
      logger.warn(
        `ProviderHealth [${this.key}]: skipping provider (${this.consecutiveFailures} consecutive failures, ` +
        `cooldown ${this.config.cooldownMs}ms, last error: ${error.message})`
      );
    }
  }

  getStatus(): { available: boolean; consecutiveFailures: number } {
    return {
      available: this.isAvailable(),
      consecutiveFailures: this.consecutiveFailures
    };
  }
}
