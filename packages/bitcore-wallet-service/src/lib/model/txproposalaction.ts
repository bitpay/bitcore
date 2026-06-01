export interface ITxProposalAction {
  version: string;
  createdOn: number;
  copayerId: string;
  type: string;
  signatures: string[];
  xpub: string;
  comment: string;

  // Non-persistent fields
  copayerName?: string;
}
export class TxProposalAction {
  version: string;
  createdOn: number;
  copayerId: string;
  type: string;
  signatures: string[];
  xpub: string;
  comment: string;

  // Non-persistent fields
  copayerName?: string;

  static create(opts) {
    opts = opts || {};

    const x = new TxProposalAction();

    x.version = '1.0.0';
    x.createdOn = Math.floor(Date.now() / 1000);
    x.copayerId = opts.copayerId;
    x.type = opts.type;
    x.signatures = opts.signatures;
    x.xpub = opts.xpub;
    x.comment = opts.comment;

    return x;
  }

  static fromObj(obj) {
    const x = new TxProposalAction();

    x.version = obj.version;
    x.createdOn = obj.createdOn;
    x.copayerId = obj.copayerId;
    x.type = obj.type;
    x.signatures = obj.signatures;
    x.xpub = obj.xpub;
    x.comment = obj.comment;

    // copayerName is not stored in the actions collection, but it is returned by the server on fetchTxProposal, so we need to set it here.
    x.copayerName = obj.copayerName; 

    return x;
  }
}
