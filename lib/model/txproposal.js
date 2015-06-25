'use strict';

var _ = require('lodash');
var Uuid = require('uuid');
var WalletUtils = require('bitcore-wallet-utils');
var Bitcore = WalletUtils.Bitcore;
var Address = Bitcore.Address;

var TxProposalAction = require('./txproposalaction');

function TxProposal() {
  this.version = '1.0.1';
};

TxProposal.Types = {
  SIMPLE: 'simple',
  MULTIPLEOUTPUTS: 'multiple_outputs',
};

TxProposal.isTypeSupported = function(type) {
  return _.contains(_.values(TxProposal.Types), type);
};

TxProposal._create = {};

TxProposal._create.simple = function(txp, opts) {
  txp.toAddress = opts.toAddress;
  txp.amount = opts.amount;
  txp.outputOrder = _.shuffle(_.range(2));
  try {
    txp.network = Bitcore.Address(txp.toAddress).toObject().network;
  } catch (ex) {}
};

TxProposal._create.undefined = TxProposal._create.simple;

TxProposal._create.multiple_outputs = function(txp, opts) {
  txp.outputs = opts.outputs;
  txp.outputOrder = _.shuffle(_.range(txp.outputs.length + 1));
  try {
    txp.network = Bitcore.Address(txp.outputs[0].toAddress).toObject().network;
  } catch (ex) {}
};

TxProposal.create = function(opts) {
  opts = opts || {};

  var x = new TxProposal();

  x.type = opts.type || TxProposal.Types.SIMPLE;

  var now = Date.now();
  x.createdOn = Math.floor(now / 1000);
  x.id = _.padLeft(now, 14, '0') + Uuid.v4();
  x.walletId = opts.walletId;
  x.creatorId = opts.creatorId;
  x.message = opts.message;
  x.payProUrl = opts.payProUrl;
  x.proposalSignature = opts.proposalSignature;
  x.changeAddress = opts.changeAddress;
  x.inputs = [];
  x.inputPaths = [];
  x.requiredSignatures = opts.requiredSignatures;
  x.requiredRejections = opts.requiredRejections;
  x.status = 'pending';
  x.actions = [];
  x.fee = null;
  x.feePerKb = opts.feePerKb;

  if (_.isFunction(TxProposal._create[x.type])) {
    TxProposal._create[x.type](x, opts);
  }

  return x;
};

TxProposal.fromObj = function(obj) {
  var x = new TxProposal();

  if (obj.version == '1.0.0') {
    x.type = TxProposal.Types.SIMPLE;
  } else {
    x.type = obj.type;
  }
  x.version = obj.version;
  x.createdOn = obj.createdOn;
  x.id = obj.id;
  x.walletId = obj.walletId;
  x.creatorId = obj.creatorId;
  x.outputs = obj.outputs;
  x.toAddress = obj.toAddress;
  x.amount = obj.amount;
  x.message = obj.message;
  x.payProUrl = obj.payProUrl;
  x.proposalSignature = obj.proposalSignature;
  x.changeAddress = obj.changeAddress;
  x.inputs = obj.inputs;
  x.requiredSignatures = obj.requiredSignatures;
  x.requiredRejections = obj.requiredRejections;
  x.status = obj.status;
  x.txid = obj.txid;
  x.broadcastedOn = obj.broadcastedOn;
  x.inputPaths = obj.inputPaths;
  x.actions = _.map(obj.actions, function(action) {
    return TxProposalAction.fromObj(action);
  });
  x.outputOrder = obj.outputOrder;
  x.fee = obj.fee;
  x.network = obj.network;
  x.feePerKb = obj.feePerKb;

  return x;
};

TxProposal.prototype.setInputs = function(inputs) {
  this.inputs = inputs;
  this.inputPaths = _.pluck(inputs, 'path');
};

TxProposal.prototype._updateStatus = function() {
  if (this.status != 'pending') return;

  if (this.isRejected()) {
    this.status = 'rejected';
  } else if (this.isAccepted()) {
    this.status = 'accepted';
  }
};


TxProposal.prototype._getCurrentSignatures = function() {
  var acceptedActions = _.filter(this.actions, {
    type: 'accept'
  });

  return _.map(acceptedActions, function(x) {
    return {
      signatures: x.signatures,
      xpub: x.xpub,
    };
  });
};

TxProposal.prototype.getBitcoreTx = function() {
  var self = this;

  var t = WalletUtils.buildTx(this);

  var sigs = this._getCurrentSignatures();
  _.each(sigs, function(x) {
    self._addSignaturesToBitcoreTx(t, x.signatures, x.xpub);
  });

  return t;
};

TxProposal.prototype.getNetworkName = function() {
  return Bitcore.Address(this.toAddress).toObject().network;
};

TxProposal.prototype.getRawTx = function() {
  var t = this.getBitcoreTx();

  return t.uncheckedSerialize();
};

/**
 * getHeader
 *
 * @return {Array} arguments for getProposalHash wallet utility method
 */
TxProposal.prototype.getHeader = function() {
  if (this.type == TxProposal.Types.MULTIPLEOUTPUTS) {
    return [{
      outputs: this.outputs,
      message: this.message,
      payProUrl: this.payProUrl
    }];
  } else {
    return [this.toAddress, this.amount, this.message, this.payProUrl];
  }
};

/**
 * getTotalAmount
 *
 * @return {Number} total amount of all outputs excluding change output
 */
TxProposal.prototype.getTotalAmount = function() {
  if (this.type == TxProposal.Types.MULTIPLEOUTPUTS) {
    return _.pluck(this.outputs, 'amount')
      .reduce(function(total, n) {
        return total + n;
      });
  } else {
    return this.amount;
  }
};

/**
 * getActors
 *
 * @return {String[]} copayerIds that performed actions in this proposal (accept / reject)
 */
TxProposal.prototype.getActors = function() {
  return _.pluck(this.actions, 'copayerId');
};


/**
 * getApprovers
 *
 * @return {String[]} copayerIds that approved the tx proposal (accept)
 */
TxProposal.prototype.getApprovers = function() {
  return _.pluck(
    _.filter(this.actions, {
      type: 'accept'
    }), 'copayerId');
};

/**
 * getActionBy
 *
 * @param {String} copayerId
 * @return {Object} type / createdOn
 */
TxProposal.prototype.getActionBy = function(copayerId) {
  return _.find(this.actions, {
    copayerId: copayerId
  });
};

TxProposal.prototype.addAction = function(copayerId, type, comment, signatures, xpub) {
  var action = TxProposalAction.create({
    copayerId: copayerId,
    type: type,
    signatures: signatures,
    xpub: xpub,
    comment: comment,
  });
  this.actions.push(action);
  this._updateStatus();
};

TxProposal.prototype._addSignaturesToBitcoreTx = function(t, signatures, xpub) {
  var self = this;

  if (signatures.length != this.inputs.length)
    throw new Error('Number of signatures does not match number of inputs');

  var i = 0,
    x = new Bitcore.HDPublicKey(xpub);

  _.each(signatures, function(signatureHex) {
    var input = self.inputs[i];
    try {
      var signature = Bitcore.crypto.Signature.fromString(signatureHex);
      var pub = x.derive(self.inputPaths[i]).publicKey;
      var s = {
        inputIndex: i,
        signature: signature,
        sigtype: Bitcore.crypto.Signature.SIGHASH_ALL,
        publicKey: pub,
      };
      t.inputs[i].addSignature(t, s);
      i++;
    } catch (e) {};
  });

  if (i != t.inputs.length)
    throw new Error('Wrong signatures');
};


TxProposal.prototype.sign = function(copayerId, signatures, xpub) {
  try {
    // Tests signatures are OK
    var t = this.getBitcoreTx();
    this._addSignaturesToBitcoreTx(t, signatures, xpub);

    this.addAction(copayerId, 'accept', null, signatures, xpub);
    return true;
  } catch (e) {
    return false;
  }
};

TxProposal.prototype.reject = function(copayerId, reason) {
  this.addAction(copayerId, 'reject', reason);
};

TxProposal.prototype.isPending = function() {
  return !_.contains(['broadcasted', 'rejected'], this.status);
};

TxProposal.prototype.isAccepted = function() {
  var votes = _.countBy(this.actions, 'type');
  return votes['accept'] >= this.requiredSignatures;
};

TxProposal.prototype.isRejected = function() {
  var votes = _.countBy(this.actions, 'type');
  return votes['reject'] >= this.requiredRejections;
};

TxProposal.prototype.isBroadcasted = function() {
  return this.status == 'broadcasted';
};

TxProposal.prototype.setBroadcasted = function(txid) {
  this.txid = txid;
  this.status = 'broadcasted';
  this.broadcastedOn = Math.floor(Date.now() / 1000);
};

module.exports = TxProposal;
