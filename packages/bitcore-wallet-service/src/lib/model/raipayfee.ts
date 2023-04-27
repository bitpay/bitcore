export interface IRaipayFee {
  coin: string;
  feePercentage: number;
  feeQuantity: number;
}

export class RaipayFee implements IRaipayFee {
  coin: string;
  feePercentage: number;
  feeQuantity: number;
  static create(opts) {
    const x = new RaipayFee();
    x.coin = opts.coin;
    x.feePercentage = opts.feePercentage;
    x.feeQuantity = opts.feeQuantity;
    return x;
  }
  static fromObj(obj) {
    const x = new RaipayFee();
    x.coin = obj.coin;
    x.feePercentage = obj.feePercentage;
    x.feeQuantity = obj.feeQuantity;
    return x;
  }
}
