'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var log = require('npmlog');
log.debug = log.verbose;
log.disableColor();

var Bitcore = require('bitcore-lib');

var Common = require('../common');
var Constants = Common.Constants;
var Defaults = Common.Defaults;

var TxProposalAction = require('./txproposalaction');

function throwUnsupportedError() {
  var msg = 'Unsupported operation on this transaction proposal';
  log.warn('DEPRECATED: ' + msg);
  throw new Error(msg);
}

export interface ITxProposal {
  version: string;
  type: string;
  createdOn: number;
  id: number;
  walletId: string;
  creatorId: string;
  outputs: Array<any>;
  toAddress: string;
  amount: number;
  message: string;
  payProUrl: string;
  proposalSignature: string;
  changeAddress: string;
  inputs: Array<any>;
  requiredSignatures: number;
  requiredRejections: number;
  walletN: number;
  status: string;
  txid: string;
  broadcastedOn: string;
  inputPaths: string;
  actions: Array<any>;
  outputOrder: number;
  coin: string;
  network: string;
  fee: number;
  feePerKb: number;
  excludeUnconfirmedUtxos: boolean;
  proposalSignaturePubKey: string;
  proposalSignaturePubKeySig: string;
  addressType: string;
  derivationStrategy: string;
  customData: any;
}
export class TxProposal {
  version: string;
  type: string;
  createdOn: number;
  id: number;
  walletId: string;
  creatorId: string;
  outputs: Array<any>;
  toAddress: string;
  amount: number;
  message: string;
  payProUrl: string;
  proposalSignature: string;
  changeAddress: string;
  inputs: Array<any>;
  requiredSignatures: number;
  requiredRejections: number;
  walletN: number;
  status: string;
  txid: string;
  broadcastedOn: string;
  inputPaths: string;
  actions: Array<any>;
  outputOrder: number;
  coin: string;
  network: string;
  fee: number;
  feePerKb: number;
  excludeUnconfirmedUtxos: boolean;
  proposalSignaturePubKey: string;
  proposalSignaturePubKeySig: string;
  addressType: string;
  derivationStrategy: string;
  customData: any;

  static Types = {
    SIMPLE: 'simple',
    MULTIPLEOUTPUTS: 'multiple_outputs',
    EXTERNAL: 'external'
  };

  static fromObj = function(obj) {
    var x = new TxProposal();

    x.version = obj.version;
    if (obj.version === '1.0.0') {
      x.type = TxProposal.Types.SIMPLE;
    } else {
      x.type = obj.type;
    }
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
    x.walletN = obj.walletN;
    x.status = obj.status;
    x.txid = obj.txid;
    x.broadcastedOn = obj.broadcastedOn;
    x.inputPaths = obj.inputPaths;
    x.actions = _.map(obj.actions, function(action) {
      return TxProposalAction.fromObj(action);
    });
    x.outputOrder = obj.outputOrder;
    x.coin = obj.coin || Defaults.COIN;
    x.network = obj.network;
    x.fee = obj.fee;
    x.feePerKb = obj.feePerKb;
    x.excludeUnconfirmedUtxos = obj.excludeUnconfirmedUtxos;
    x.proposalSignaturePubKey = obj.proposalSignaturePubKey;
    x.proposalSignaturePubKeySig = obj.proposalSignaturePubKeySig;
    x.addressType = obj.addressType || Constants.SCRIPT_TYPES.P2SH;
    x.derivationStrategy =
      obj.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP45;
    x.customData = obj.customData;

    return x;
  };

  toObject = function() {
    var x = _.cloneDeep(this);
    x.isPending = this.isPending();
    return x;
  };

  _updateStatus = function() {
    if (this.status != 'pending') return;

    if (this.isRejected()) {
      this.status = 'rejected';
    } else if (this.isAccepted()) {
      this.status = 'accepted';
    }
  };

  getBitcoreTx = function() {
    throwUnsupportedError();
  };

  getRawTx = function() {
    throwUnsupportedError();
  };

  getTotalAmount = function() {
    if (
      this.type == TxProposal.Types.MULTIPLEOUTPUTS ||
      this.type == TxProposal.Types.EXTERNAL
    ) {
      return _.map(this.outputs, 'amount').reduce(function(total, n) {
        return total + n;
      }, 0);
    } else {
      return this.amount;
    }
  };

  getActors = function() {
    return _.map(this.actions, 'copayerId');
  };

  getApprovers = function() {
    return _.map(
      _.filter(this.actions, {
        type: 'accept'
      }),
      'copayerId'
    );
  };

  getActionBy = function(copayerId) {
    return _.find(this.actions, {
      copayerId: copayerId
    });
  };

  addAction = function(copayerId, type, comment, signatures, xpub) {
    var action = TxProposalAction.create({
      copayerId: copayerId,
      type: type,
      signatures: signatures,
      xpub: xpub,
      comment: comment
    });
    this.actions.push(action);
    this._updateStatus();
  };

  sign = function() {
    throwUnsupportedError();
  };

  reject = function(copayerId, reason) {
    this.addAction(copayerId, 'reject', reason);
  };

  isPending = function() {
    return !_.includes(['broadcasted', 'rejected'], this.status);
  };

  isAccepted = function() {
    var votes = _.countBy(this.actions, 'type');
    return votes['accept'] >= this.requiredSignatures;
  };

  isRejected = function() {
    var votes = _.countBy(this.actions, 'type');
    return votes['reject'] >= this.requiredRejections;
  };

  isBroadcasted = function() {
    return this.status == 'broadcasted';
  };

  setBroadcasted = function() {
    $.checkState(this.txid);
    this.status = 'broadcasted';
    this.broadcastedOn = Math.floor(Date.now() / 1000);
  };
}
