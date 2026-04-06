export interface LoggerConfig {
  /** Environment variable prefix, e.g. 'BCN' reads BCN_LOG_LEVEL, BCN_LOG_HTTP_HOST, etc. */
  prefix: string;
  /** Default log level when env var is not set (default: 'info') */
  defaultLevel?: string;
  /** Force debug log level (e.g. from a --DEBUG CLI flag) */
  debug?: boolean;
}
