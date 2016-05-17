var _ = require('lodash');
var Uuid = require('uuid');

function TxNote() {};

TxNote.create = function(opts) {
  opts = opts || {};

  var x = new TxNote();

  x.version = 1;
  x.walletId = opts.walletId;
  x.txid = opts.txid;
  x.body = opts.body;
  x.lastEditedOn = Math.floor(Date.now() / 1000);
  x.lastEditedById = opts.lastEditedById;

  return x;
};

TxNote.fromObj = function(obj) {
  var x = new TxNote();

  x.version = obj.version;
  x.walletId = obj.walletId;
  x.txid = obj.txid;
  x.body = obj.body;
  x.lastEditedOn = obj.lastEditedOn;
  x.lastEditedById = obj.lastEditedById;

  return x;
};

module.exports = TxNote;
