export interface IMerchantInfo {
  code: string;
  name: string;
  walletAddress: string;
  merchantAddress?: string;
  email: string;
  isElpsAccepted: boolean;
}

export class MerchantInfo implements IMerchantInfo {
  code: string;
  name: string;
  walletAddress: string;
  merchantAddress?: string;
  email: string;
  isElpsAccepted: boolean;

  static create(opts) {
    opts = opts || {};
    const x = new MerchantInfo();
    const now = new Date();
    x.code = opts.code;
    x.name = opts.name;
    x.walletAddress = opts.walletAddress;
    x.merchantAddress = opts.merchantAddress || null;
    x.email = opts.email;
    x.isElpsAccepted = opts.isElpsAccepted;
    return x;
  }

  static fromObj(obj) {
    const x = new MerchantInfo();
    x.code = obj.code;
    x.name = obj.name;
    x.walletAddress = obj.walletAddress;
    x.merchantAddress = obj.merchantAddress || null;
    x.email = obj.email;
    x.isElpsAccepted = obj.isElpsAccepted;
    return x;
  }
}
