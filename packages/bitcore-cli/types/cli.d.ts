export interface ICliOptions {
  dir: string;
  host: string;
  command?: string;
  verbose: boolean;
  exit: boolean;
  pageSize: number;
  walletId?: string;
}