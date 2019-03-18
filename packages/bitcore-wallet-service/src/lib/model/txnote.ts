var _ = require('lodash');
var Uuid = require('uuid');

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

  static create = function(opts) {
    opts = opts || {};

    var now = Math.floor(Date.now() / 1000);

    var x = new TxNote();

    x.version = 1;
    x.createdOn = now;
    x.walletId = opts.walletId;
    x.txid = opts.txid;
    x.body = opts.body;
    x.editedOn = now;
    x.editedBy = opts.copayerId;

    return x;
  };

  static fromObj = function(obj) {
    var x = new TxNote();

    x.version = obj.version;
    x.createdOn = obj.createdOn;
    x.walletId = obj.walletId;
    x.txid = obj.txid;
    x.body = obj.body;
    x.editedOn = obj.editedOn;
    x.editedBy = obj.editedBy;

    return x;
  };

  edit = function(body, copayerId) {
    this.body = body;
    this.editedBy = copayerId;
    this.editedOn = Math.floor(Date.now() / 1000);
  };

  toObject = function() {
    return this;
  };
}

module.exports = TxNote;
