var Uuid = require('uuid');

/*
 * notifications examples
 *
 * NewCopayer -
 * NewAddress -
 * NewTxProposal - (amount)
 * TxProposalAcceptedBy - (txProposalId, copayerId)
 * TxProposalRejectedBy -  (txProposalId, copayerId)
 * txProposalFinallyRejected - txProposalId
 * txProposalFinallyAccepted - txProposalId
 *
 * newIncommingTx (amount)
 * newOutgoingTx - (txProposalId, txid)
 *
 * data Examples:
 * { amount: 'xxx', address: 'xxx'}
 * { txProposalId: 'xxx', copayerId: 'xxx' }
 *
 * Data is meant to provide only the needed information
 * to notify the user
 *
 */
function Notification() {
  this.version = '1.0.0';
};

Notification.create = function(opts) {
  opts = opts || {};

  var x = new Notification();

  var now = Date.now();
  x.createdOn = Math.floor(now / 1000);
  x.id = ('00000000000000' + now).slice(-14) + ('0000' + opts.ticker || 0).slice(-4);
  x.type = opts.type || 'general';
  x.data = opts.data;

  return x;
};

Notification.fromObj = function(obj) {
  var x = new Notification();

  x.createdOn = obj.createdOn;
  x.id = obj.id;
  x.type = obj.type,
  x.data = obj.data;

  return x;
};

module.exports = Notification;
