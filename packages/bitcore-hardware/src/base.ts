export interface Base {
  sign(params: { amount: number }): object;
  connect(): void;
};
