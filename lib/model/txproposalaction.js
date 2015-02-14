'use strict';

function TxProposalAction(opts) {
  opts = opts || {};

  this.createdOn = Math.floor(Date.now() / 1000);
  this.copayerId = opts.copayerId;
  this.type = opts.type || (opts.signatures ? 'accept' : 'reject');
  this.signatures = opts.signatures;
  this.xpub = opts.xpub;
};

TxProposalAction.fromObj = function (obj) {
  var x = new TxProposalAction();

  x.createdOn = obj.createdOn;
  x.copayerId = obj.copayerId;
  x.type = obj.type;
  x.signatures = obj.signatures;
  x.xpub = obj.xpub;

  return x;
};

module.exports = TxProposalAction;
