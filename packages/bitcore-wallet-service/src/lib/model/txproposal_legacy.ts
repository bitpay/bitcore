import _ from 'lodash';
import logger from '../logger';

const $ = require('preconditions').singleton();
const Common = require('../common');
const Constants = Common.Constants;
const Defaults = Common.Defaults;
import { TxProposalAction } from './txproposalaction';

function throwUnsupportedError() {
  const msg = 'Unsupported operation on this transaction proposal';
  logger.warn('DEPRECATED: ' + msg);
  throw new Error(msg);
}

export interface ITxProposal {
  version: string;
  type: string;
  createdOn: number;
  id: number;
  walletId: string;
  creatorId: string;
  outputs: any[];
  toAddress: string;
  amount: number;
  message: string;
  payProUrl: string;
  proposalSignature: string;
  changeAddress: string;
  inputs: any[];
  requiredSignatures: number;
  requiredRejections: number;
  walletN: number;
  status: string;
  txid: string;
  broadcastedOn: string;
  inputPaths: string;
  actions: any[];
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
export class TxProposalLegacy {
  version: string;
  type: string;
  createdOn: number;
  id: number;
  walletId: string;
  creatorId: string;
  outputs: any[];
  toAddress: string;
  amount: number;
  message: string;
  payProUrl: string;
  proposalSignature: string;
  changeAddress: string;
  inputs: any[];
  requiredSignatures: number;
  requiredRejections: number;
  walletN: number;
  status: string;
  txid: string;
  broadcastedOn: number;
  inputPaths: string;
  actions: any[];
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

  static fromObj(obj) {
    const x = new TxProposalLegacy();

    x.version = obj.version;
    if (obj.version === '1.0.0') {
      x.type = TxProposalLegacy.Types.SIMPLE;
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
    x.derivationStrategy = obj.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP45;
    x.customData = obj.customData;

    return x;
  }

  toObject() {
    const x: any = _.cloneDeep(this);
    x.isPending = this.isPending();
    return x;
  }

  _updateStatus() {
    if (this.status != 'pending') return;

    if (this.isRejected()) {
      this.status = 'rejected';
    } else if (this.isAccepted()) {
      this.status = 'accepted';
    }
  }

  getBitcoreTx() {
    throwUnsupportedError();
  }

  getRawTx() {
    throwUnsupportedError();
  }

  getTotalAmount() {
    if (this.type == TxProposalLegacy.Types.MULTIPLEOUTPUTS || this.type == TxProposalLegacy.Types.EXTERNAL) {
      return _.map(this.outputs, 'amount').reduce(function(total, n) {
        return total + n;
      }, 0);
    } else {
      return this.amount;
    }
  }

  getActors() {
    return _.map(this.actions, 'copayerId');
  }

  getApprovers() {
    return _.map(
      _.filter(this.actions, a => {
        return a.type == 'accept';
      }),
      'copayerId'
    );
  }

  getActionBy(copayerId) {
    return _.find(this.actions, {
      copayerId
    });
  }

  addAction(copayerId, type, comment, signatures?, xpub?) {
    const action = TxProposalAction.create({
      copayerId,
      type,
      signatures,
      xpub,
      comment
    });
    this.actions.push(action);
    this._updateStatus();
  }

  sign() {
    throwUnsupportedError();
  }

  reject(copayerId, reason) {
    this.addAction(copayerId, 'reject', reason);
  }

  isPending() {
    return !_.includes(['broadcasted', 'rejected'], this.status);
  }

  isAccepted() {
    const votes = _.countBy(this.actions, 'type');
    return votes['accept'] >= this.requiredSignatures;
  }

  isRejected() {
    const votes = _.countBy(this.actions, 'type');
    return votes['reject'] >= this.requiredRejections;
  }

  isBroadcasted() {
    return this.status == 'broadcasted';
  }

  setBroadcasted() {
    $.checkState(this.txid, 'Failed state: this.txid at setBroadcasted()');
    this.status = 'broadcasted';
    this.broadcastedOn = Math.floor(Date.now() / 1000);
  }
}
