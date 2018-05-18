export default interface Config {
  pruneSpentScripts: boolean;
  maxPoolSize: number;
  port: number;
  dbHost: string;
  dbName: string;
  numWorkers: number;

  chains: {
    [currency: string]: any
  }
}
