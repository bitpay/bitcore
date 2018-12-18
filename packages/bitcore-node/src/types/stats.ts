export interface DailyTransactionsJSON {
  chain: string;
  network: string;
  results: Array<{
    date: string;
    transactionCount: number;
  }>;
}
