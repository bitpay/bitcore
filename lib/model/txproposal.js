'use strict';

var _ = require('lodash');
var Guid = require('guid');

var TxProposalAction = require('./txproposalaction');

var VERSION = '1.0.0';

function TxProposal(opts) {
  opts = opts || {};

  this.version = VERSION;
  this.createdOn = Math.floor(Date.now() / 1000);
  this.id = Guid.raw();
  this.creatorId = opts.creatorId;
  this.toAddress = opts.toAddress;
  this.amount = opts.amount;
  this.message = opts.message;
  this.changeAddress = opts.changeAddress;
  this.inputs = opts.inputs;
  this.requiredSignatures = opts.requiredSignatures;
  this.maxRejections = opts.maxRejections;
  this.status = 'pending';
  this.actions = [];
};

TxProposal.fromObj = function (obj) {
  var x = new TxProposal();

  x.version = obj.version;
  x.createdOn = obj.createdOn;
  x.id = obj.id;
  x.creatorId = obj.creatorId;
  x.toAddress = obj.toAddress;
  x.amount = obj.amount;
  x.message = obj.message;
  x.changeAddress = obj.changeAddress;
  x.inputs = obj.inputs;
  x.rawTx = obj.rawTx;
  x.requiredSignatures = obj.requiredSignatures;
  x.maxRejections = obj.maxRejections;
  x.status = obj.status;
  x.txid = obj.txid;
  x.actions = _.map(obj.actions, function(action) {
    return new TxProposalAction(action);
  });

  return x;
};

TxProposal.prototype._updateStatus = function () {
  if (this.status != 'pending') return;

  if (this.isRejected()) {
    this.status = 'rejected';
  } else if (this.isAccepted()) {
    this.status = 'accepted';
  }
};

TxProposal.prototype.addAction = function (copayerId, type, signature) {
  var action = new TxProposalAction({
    copayerId: copayerId,
    type: type,
    signature: signature,
  });
  this.actions.push(action);
  this._updateStatus();
};

TxProposal.prototype.sign = function (copayerId, signature) {
  this.addAction(copayerId, 'accept', signature);
};

TxProposal.prototype.reject = function (copayerId) {
  this.addAction(copayerId, 'reject');
};

TxProposal.prototype.isAccepted = function () {
  var votes = _.countBy(this.actions, 'type');
  return votes['accept'] >= this.requiredSignatures;
};

TxProposal.prototype.isRejected = function () {
  var votes = _.countBy(this.actions, 'type');
  return votes['reject'] > this.maxRejections;
};

TxProposal.prototype.setBroadcasted = function (txid) {
  this.txid = txid;
  this.status = 'broadcasted';
};

module.exports = TxProposal;
