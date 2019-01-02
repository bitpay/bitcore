export interface ConfigType {
  maxPoolSize: number;
  port: number;
  dbHost: string;
  dbName: string;
  dbPort: string;
  numWorkers: number;

  chains: {
    [currency: string]: { [network: string]: any };
  };
  services: {
    api: {
      enabled: boolean;
      rateLimiter: {
        whitelist: [string];
      };
      wallets: {
        allowCreationBeforeCompleteSync?: boolean;
        allowUnauthenticatedCalls?: boolean;
      };
    };
    event: {
      enabled: boolean;
    };
    p2p: {
      enabled: boolean;
    };
    socket: {
      enabled: boolean;
    };
    storage: {
      enabled: boolean;
    };
  };
}
