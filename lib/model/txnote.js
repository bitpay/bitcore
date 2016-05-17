var _ = require('lodash');
var Uuid = require('uuid');

function TxNote() {};

TxNote.create = function(opts) {
  opts = opts || {};

  var now = Math.floor(Date.now() / 1000);

  var x = new TxNote();

  x.version = 1;
  x.createdOn = now;
  x.walletId = opts.walletId;
  x.txid = opts.txid;
  x.body = opts.body;
  x.lastEditedOn = now;
  x.lastEditedBy = opts.copayerId;

  return x;
};

TxNote.fromObj = function(obj) {
  var x = new TxNote();

  x.version = obj.version;
  x.createdOn = obj.createdOn;
  x.walletId = obj.walletId;
  x.txid = obj.txid;
  x.body = obj.body;
  x.lastEditedOn = obj.lastEditedOn;
  x.lastEditedBy = obj.lastEditedBy;

  return x;
};

TxNote.prototype.edit = function(body, copayerId) {
  this.body = body;
  this.lastEditedBy = copayerId;
  this.lastEditedOn = Math.floor(Date.now() / 1000);
};

TxNote.prototype.toObject = function() {
  return this;
};

module.exports = TxNote;
