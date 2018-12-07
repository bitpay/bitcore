'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var Uuid = require('uuid');
var log = require('npmlog');
log.debug = log.verbose;
log.disableColor();

var Bitcore = {
  'btc': require('bitcore-lib'),
  'bch': require('bitcore-lib-cash'),
};

var Common = require('../common');
var Constants = Common.Constants,
  Defaults = Common.Defaults,
  Utils = Common.Utils;

var TxProposalLegacy = require('./txproposal_legacy');
var TxProposalAction = require('./txproposalaction');

function TxProposal() {};

TxProposal.create = function(opts) {
  opts = opts || {};

  $.checkArgument(Utils.checkValueInCollection(opts.coin, Constants.COINS));
  $.checkArgument(Utils.checkValueInCollection(opts.network, Constants.NETWORKS));

  var x = new TxProposal();

  x.version = 3;

  var now = Date.now();
  x.createdOn = Math.floor(now / 1000);
  x.id = opts.id || Uuid.v4();
  x.walletId = opts.walletId;
  x.creatorId = opts.creatorId;
  x.coin = opts.coin;
  x.network = opts.network;
  x.message = opts.message;
  x.payProUrl = opts.payProUrl;
  x.changeAddress = opts.changeAddress;
  x.outputs = _.map(opts.outputs, function(output) {
    return _.pick(output, ['amount', 'toAddress', 'message', 'script']);
  });
  x.outputOrder = _.range(x.outputs.length + 1);
  if (!opts.noShuffleOutputs) {
    x.outputOrder = _.shuffle(x.outputOrder);
  }
  x.walletM = opts.walletM;
  x.walletN = opts.walletN;
  x.requiredSignatures = x.walletM;
  x.requiredRejections = Math.min(x.walletM, x.walletN - x.walletM + 1),
  x.status = 'temporary';
  x.actions = [];
  x.feeLevel = opts.feeLevel;
  x.feePerKb = opts.feePerKb;
  x.excludeUnconfirmedUtxos = opts.excludeUnconfirmedUtxos;

  x.addressType = opts.addressType || (x.walletN > 1 ? Constants.SCRIPT_TYPES.P2SH : Constants.SCRIPT_TYPES.P2PKH);
  $.checkState(Utils.checkValueInCollection(x.addressType, Constants.SCRIPT_TYPES));

  x.customData = opts.customData;

  x.amount = x.getTotalAmount();

  x.setInputs(opts.inputs);
  x.fee = opts.fee;

  return x;
};

TxProposal.fromObj = function(obj) {
  if (!(obj.version >= 3)) {
    return TxProposalLegacy.fromObj(obj);
  }

  var x = new TxProposal();

  x.version = obj.version;
  x.createdOn = obj.createdOn;
  x.id = obj.id;
  x.walletId = obj.walletId;
  x.creatorId = obj.creatorId;
  x.coin = obj.coin || Defaults.COIN;
  x.network = obj.network;
  x.outputs = obj.outputs;
  x.amount = obj.amount;
  x.message = obj.message;
  x.payProUrl = obj.payProUrl;
  x.changeAddress = obj.changeAddress;
  x.inputs = obj.inputs;
  x.walletM = obj.walletM;
  x.walletN = obj.walletN;
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
  x.feeLevel = obj.feeLevel;
  x.feePerKb = obj.feePerKb;
  x.excludeUnconfirmedUtxos = obj.excludeUnconfirmedUtxos;
  x.addressType = obj.addressType;
  x.customData = obj.customData;

  x.proposalSignature = obj.proposalSignature;
  x.proposalSignaturePubKey = obj.proposalSignaturePubKey;
  x.proposalSignaturePubKeySig = obj.proposalSignaturePubKeySig;

  return x;
};

TxProposal.prototype.toObject = function() {
  var x = _.cloneDeep(this);
  x.isPending = this.isPending();
  return x;
};

TxProposal.prototype.setInputs = function(inputs) {
  this.inputs = inputs || [];
  this.inputPaths = _.map(inputs, 'path') || [];
};

TxProposal.prototype._updateStatus = function() {
  if (this.status != 'pending') return;

  if (this.isRejected()) {
    this.status = 'rejected';
  } else if (this.isAccepted()) {
    this.status = 'accepted';
  }
};

TxProposal.prototype._buildTx = function() {
  var self = this;

  var t = new Bitcore[self.coin].Transaction();

  $.checkState(Utils.checkValueInCollection(self.addressType, Constants.SCRIPT_TYPES));

  switch (self.addressType) {
    case Constants.SCRIPT_TYPES.P2SH:
      _.each(self.inputs, function(i) {
        $.checkState(i.publicKeys, 'Inputs should include public keys');
        t.from(i, i.publicKeys, self.requiredSignatures);
      });
      break;
    case Constants.SCRIPT_TYPES.P2PKH:
      t.from(self.inputs);
      break;
  }

  _.each(self.outputs, function(o) {
    $.checkState(o.script || o.toAddress, 'Output should have either toAddress or script specified');
    if (o.script) {
      t.addOutput(new Bitcore[self.coin].Transaction.Output({
        script: o.script,
        satoshis: o.amount
      }));
    } else {
      t.to(o.toAddress, o.amount);
    }
  });

  t.fee(self.fee);

  if (self.changeAddress) {
    t.change(self.changeAddress.address);
  }

  // Shuffle outputs for improved privacy
  if (t.outputs.length > 1) {
    var outputOrder = _.reject(self.outputOrder, function(order) {
      return order >= t.outputs.length;
    });
    $.checkState(t.outputs.length == outputOrder.length);
    t.sortOutputs(function(outputs) {
      return _.map(outputOrder, function(i) {
        return outputs[i];
      });
    });
  }

  // Validate actual inputs vs outputs independently of Bitcore
  var totalInputs = _.sumBy(t.inputs, 'output.satoshis');
  var totalOutputs = _.sumBy(t.outputs, 'satoshis');

  $.checkState(totalInputs > 0 && totalOutputs > 0 && totalInputs >= totalOutputs, 'not-enought-inputs');
  $.checkState(totalInputs - totalOutputs <= Defaults.MAX_TX_FEE, 'fee-too-high');

  return t;
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

  var t = this._buildTx();

  var sigs = this._getCurrentSignatures();
  _.each(sigs, function(x) {
    self._addSignaturesToBitcoreTx(t, x.signatures, x.xpub);
  });

  return t;
};

TxProposal.prototype.getRawTx = function() {
  var t = this.getBitcoreTx();

  return t.uncheckedSerialize();
};

TxProposal.prototype.getEstimatedSizeForSingleInput = function() {
  switch (this.addressType) {
    case Constants.SCRIPT_TYPES.P2PKH:
      return 147;
    default:
    case Constants.SCRIPT_TYPES.P2SH:
      return this.requiredSignatures * 72 + this.walletN * 36 + 44;
  }
};

TxProposal.prototype.getEstimatedSize = function() {
  // Note: found empirically based on all multisig P2SH inputs and within m & n allowed limits.
  var safetyMargin = 0.02;

  var overhead = 4 + 4 + 9 + 9;
  var inputSize = this.getEstimatedSizeForSingleInput();
  var outputSize = 34;
  var nbInputs = this.inputs.length;
  var nbOutputs = (_.isArray(this.outputs) ? Math.max(1, this.outputs.length) : 1) + 1;

  var size = overhead + inputSize * nbInputs + outputSize * nbOutputs;

  return parseInt((size * (1 + safetyMargin)).toFixed(0));
};

TxProposal.prototype.getEstimatedFee = function() {
  $.checkState(_.isNumber(this.feePerKb));
  var fee = this.feePerKb * this.getEstimatedSize() / 1000;
  return parseInt(fee.toFixed(0));
};

TxProposal.prototype.estimateFee = function() {
  this.fee = this.getEstimatedFee();
};

/**
 * getTotalAmount
 *
 * @return {Number} total amount of all outputs excluding change output
 */
TxProposal.prototype.getTotalAmount = function() {
  return _.sumBy(this.outputs, 'amount');
};

/**
 * getActors
 *
 * @return {String[]} copayerIds that performed actions in this proposal (accept / reject)
 */
TxProposal.prototype.getActors = function() {
  return _.map(this.actions, 'copayerId');
};


/**
 * getApprovers
 *
 * @return {String[]} copayerIds that approved the tx proposal (accept)
 */
TxProposal.prototype.getApprovers = function() {
  return _.map(
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

TxProposal.prototype._addSignaturesToBitcoreTx = function(tx, signatures, xpub) {
  var self = this;

  var bitcore = Bitcore[self.coin];

  if (signatures.length != this.inputs.length)
    throw new Error('Number of signatures does not match number of inputs');

  var i = 0,
    x = new bitcore.HDPublicKey(xpub);

  _.each(signatures, function(signatureHex) {
    var input = self.inputs[i];
    try {
      var signature = bitcore.crypto.Signature.fromString(signatureHex);
      var pub = x.deriveChild(self.inputPaths[i]).publicKey;
      var s = {
        inputIndex: i,
        signature: signature,
        sigtype: bitcore.crypto.Signature.SIGHASH_ALL | bitcore.crypto.Signature.SIGHASH_FORKID,
        publicKey: pub,
      };
      tx.inputs[i].addSignature(tx, s);
      i++;
    } catch (e) {};
  });

  if (i != tx.inputs.length)
    throw new Error('Wrong signatures');
};


TxProposal.prototype.sign = function(copayerId, signatures, xpub) {
  try {
    // Tests signatures are OK
    var tx = this.getBitcoreTx();
    this._addSignaturesToBitcoreTx(tx, signatures, xpub);

    this.addAction(copayerId, 'accept', null, signatures, xpub);

    if (this.status == 'accepted') {
      this.raw = tx.uncheckedSerialize();
      this.txid = tx.id;
    }

    return true;
  } catch (e) {
    log.debug(e);
    return false;
  }
};

TxProposal.prototype.reject = function(copayerId, reason) {
  this.addAction(copayerId, 'reject', reason);
};

TxProposal.prototype.isTemporary = function() {
  return this.status == 'temporary';
};

TxProposal.prototype.isPending = function() {
  return !_.includes(['temporary', 'broadcasted', 'rejected'], this.status);
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

TxProposal.prototype.setBroadcasted = function() {
  $.checkState(this.txid);
  this.status = 'broadcasted';
  this.broadcastedOn = Math.floor(Date.now() / 1000);
};

module.exports = TxProposal;
