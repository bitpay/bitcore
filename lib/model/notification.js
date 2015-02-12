

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

  var now = Date.now();
  this.createdOn = Math.floor(now / 1000);
  this.id = ('00000000000000' + now).slice(-14) + ('0000' + opts.ticker||0).slice(-4) ;
  this.type = opts.type || 'general';
  this.data = opts.data;
};

Notification.fromObj = function(obj) {
  var x= new Notification();

  x.createdOn = obj.createdOn;
  x.type = obj.type,
  x.data = obj.data;

  return x;
};

module.exports = Notification;
