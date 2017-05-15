'use strict';

function TxConfirmationSub() {};

TxConfirmationSub.create = function(opts) {
  opts = opts || {};

  var x = new TxConfirmationSub();

  x.version = 1;
  x.createdOn = Math.floor(Date.now() / 1000);
  x.copayerId = opts.copayerId;
  x.txid = opts.txid;
  x.nbConfirmations = opts.nbConfirmations || 1;
  x.isActive = true;
  return x;
};

TxConfirmationSub.fromObj = function(obj) {
  var x = new TxConfirmationSub();

  x.version = obj.version;
  x.createdOn = obj.createdOn;
  x.copayerId = obj.copayerId;
  x.txid = obj.txid;
  x.nbConfirmations = obj.nbConfirmations;
  x.isActive = obj.isActive;
  return x;
};


module.exports = TxConfirmationSub;
