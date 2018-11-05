export default interface Config {
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
