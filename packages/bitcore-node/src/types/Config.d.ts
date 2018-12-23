export default interface Config {
  maxPoolSize: number;
  port: number;
  dbHost: string;
  dbName: string;
  dbPort: string;
  numWorkers: number;

  chains: {
    [currency: string]: any;
  };
  api: {
    rateLimiter: {
      whitelist: [string]; 
    },
    wallets: {
      allowCreationBeforeCompleteSync?: boolean;
      allowUnauthenticatedCalls?: boolean;
    };
  };
}
