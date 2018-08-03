export default interface Config {
  pruneSpentScripts: boolean;
  maxPoolSize: number;
  port: number;
  dbHost: string;
  dbName: string;
  dbPort: string;
  numWorkers: number;

  chains: {
    [currency: string]: any
  }
}
