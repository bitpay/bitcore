export interface ITxConfirmationSub {
  version: number;
  createdOn: number;
  walletId: string;
  copayerId: string;
  txid: string;
  amount: number;
  isActive: boolean;
  isCreator: boolean;
}
export class TxConfirmationSub {
  version: number;
  createdOn: number;
  walletId: string;
  copayerId: string;
  txid: string;
  amount: number;
  isActive: boolean;
  isCreator: boolean;

  static create(opts) {
    opts = opts || {};

    const x = new TxConfirmationSub();

    x.version = 1;
    x.createdOn = Math.floor(Date.now() / 1000);
    x.walletId = opts.walletId;
    x.copayerId = opts.copayerId;
    x.txid = opts.txid;
    x.isActive = true;
    x.amount = opts.amount;
    x.isCreator = opts.isCreator;
    return x;
  }

  static fromObj(obj) {
    const x = new TxConfirmationSub();

    x.version = obj.version;
    x.createdOn = obj.createdOn;
    x.walletId = obj.walletId;
    x.copayerId = obj.copayerId;
    x.txid = obj.txid;
    x.amount = obj.amount;
    x.isActive = obj.isActive;
    x.isCreator = obj.isCreator;
    return x;
  }
}
