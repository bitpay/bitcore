export interface ITxNote {
  version: number;
  createdOn: number;
  walletId: string;
  txid: string;
  body: string;
  editedOn: number;
  editedBy: string;
}
export class TxNote {
  version: number;
  createdOn: number;
  walletId: string;
  txid: string;
  body: string;
  editedOn: number;
  editedBy: string;

  static create(opts) {
    opts = opts || {};

    const now = Math.floor(Date.now() / 1000);

    const x = new TxNote();

    x.version = 1;
    x.createdOn = now;
    x.walletId = opts.walletId;
    x.txid = opts.txid;
    x.body = opts.body;
    x.editedOn = now;
    x.editedBy = opts.copayerId;

    return x;
  }

  static fromObj(obj) {
    const x = new TxNote();

    x.version = obj.version;
    x.createdOn = obj.createdOn;
    x.walletId = obj.walletId;
    x.txid = obj.txid;
    x.body = obj.body;
    x.editedOn = obj.editedOn;
    x.editedBy = obj.editedBy;

    return x;
  }

  edit(body, copayerId) {
    this.body = body;
    this.editedBy = copayerId;
    this.editedOn = Math.floor(Date.now() / 1000);
  }

  toObject() {
    return this;
  }
}
