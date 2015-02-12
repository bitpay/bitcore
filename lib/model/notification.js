

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



function Notification(opts) {
  opts = opts || {};

  this.createdOn = Math.floor(Date.now() / 1000);
  this.id = ('000000000000' + this.createdOn).slice(-12) + Uuid.v4();
  this.type = opts.type || 'general';
  this.data = opts.data;
};

Notification.prototype.fromObj = function(obj) {
  var x= new Notification();

  x.createdOn = obj.createdOn;
  x.type = obj.type,
  x.data = opts.data;

  return x;
};

module.exports = Notification;
