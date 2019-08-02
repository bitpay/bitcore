export interface ITxConfirmationSub {
  version: number;
  createdOn: number;
  walletId: string;
  copayerId: string;
  txid: string;
  isActive: boolean;
}
export class TxConfirmationSub {
  version: number;
  createdOn: number;
  walletId: string;
  copayerId: string;
  txid: string;
  isActive: boolean;

  static create(opts) {
    opts = opts || {};

    const x = new TxConfirmationSub();

    x.version = 1;
    x.createdOn = Math.floor(Date.now() / 1000);
    x.walletId = opts.walletId;
    x.copayerId = opts.copayerId;
    x.txid = opts.txid;
    x.isActive = true;
    return x;
  }

  static fromObj(obj) {
    const x = new TxConfirmationSub();

    x.version = obj.version;
    x.createdOn = obj.createdOn;
    x.walletId = obj.walletId;
    x.copayerId = obj.copayerId;
    x.txid = obj.txid;
    x.isActive = obj.isActive;
    return x;
  }
}
