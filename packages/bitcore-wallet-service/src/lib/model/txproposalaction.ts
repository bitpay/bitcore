'use strict';

function TxProposalAction() {};

TxProposalAction.create = function(opts) {
  opts = opts || {};

  var x = new TxProposalAction();

  x.version = '1.0.0';
  x.createdOn = Math.floor(Date.now() / 1000);
  x.copayerId = opts.copayerId;
  x.type = opts.type;
  x.signatures = opts.signatures;
  x.xpub = opts.xpub;
  x.comment = opts.comment;

  return x;
};

TxProposalAction.fromObj = function(obj) {
  var x = new TxProposalAction();

  x.version = obj.version;
  x.createdOn = obj.createdOn;
  x.copayerId = obj.copayerId;
  x.type = obj.type;
  x.signatures = obj.signatures;
  x.xpub = obj.xpub;
  x.comment = obj.comment;

  return x;
};

module.exports = TxProposalAction;
