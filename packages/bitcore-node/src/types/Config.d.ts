export interface ConfigType {
  maxPoolSize: number;
  port: number;
  dbHost: string;
  dbName: string;
  dbPort: string;
  dbUser: string;
  dbPass: string;
  numWorkers: number;

  chains: {
    [currency: string]: { [network: string]: any };
  };
  modules: string[];
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
      onlyWalletEvents: boolean;
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
