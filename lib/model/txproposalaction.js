'use strict';

function TxProposalAction(opts) {
  opts = opts || {};

  this.createdOn = Math.floor(Date.now() / 1000);
  this.copayerId = opts.copayerId;
  this.type = opts.type || (opts.signature ? 'accept' : 'reject');
  this.signature = opts.signature;
};

TxProposalAction.fromObj = function (obj) {
  var x = new TxProposalAction();

  x.createdOn = obj.createdOn;
  x.copayerId = obj.copayerId;
  x.type = obj.type;
  x.signature = obj.signature;

  return x;
};

module.exports = TxProposalAction;
