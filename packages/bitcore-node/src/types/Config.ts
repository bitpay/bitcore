export interface ConfigType {
  maxPoolSize: number;
  port: number;
  dbHost: string;
  dbName: string;
  dbPort: string;
  numWorkers: number;
  /**
   * To enable querying by disassembled script ASM strings (e.g. for OP_RETURN
   * meta-protocols), scripts can be disassembled and the resulting ASM saved
   * alongside the source locking or unlocking script.
   *
   * To reduce unnecessary resource use (and stay below database document size
   * limits), a `lockingScriptAsmByteLimit` and `unlockingScriptAsmByteLimit` is
   * set to prevent scripts larger than the limit from being disassembled and
   * the resulting string saved separately in the database. (Note, the
   * hexadecimal-encoded version of every script is always saved to the
   * database, regardless of this setting.)
   *
   * By default, `lockingScriptAsmByteLimit` is set to `223` bytes (the standard
   * default `MAX_OP_RETURN_RELAY` for BCH). This covers most locking script
   * querying use cases.
   */
  lockingScriptAsmByteLimit: number;
  /**
   * See `lockingScriptAsmByteLimit` for information on AsmByteLimits.
   *
   * Since few use cases require searching disassembled unlocking scripts,
   * `unlockingScriptAsmByteLimit` is disabled by default (set to `0` bytes).
   */
  unlockingScriptAsmByteLimit: number;

  chains: {
    [currency: string]: { [network: string]: any };
  };
  services: {
    api: {
      disabled?: boolean;
      rateLimiter?: {
        disabled?: boolean;
        whitelist: string[];
      };
      wallets?: {
        allowCreationBeforeCompleteSync?: boolean;
        allowUnauthenticatedCalls?: boolean;
      };
    };
    event: {
      disabled?: boolean;
    };
    p2p: {
      disabled?: boolean;
    };
    socket: {
      disabled?: boolean;
    };
    storage: {
      disabled?: boolean;
    };
  };
}
