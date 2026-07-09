export interface Base {
  connect(): void;
  sign(params: { amount: number }): object;
  genKey(params: { index: number; entropy: string }): object;
};
