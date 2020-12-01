import { Transactions } from 'crypto-wallet-core';
import _ from 'lodash';
import { ChainService } from '../chain/index';
import logger from '../logger';
import { TxProposalLegacy } from './txproposal_legacy';
import { TxProposalAction } from './txproposalaction';

const $ = require('preconditions').singleton();
const Uuid = require('uuid');

const Common = require('../common');
const Constants = Common.Constants,
  Defaults = Common.Defaults,
  Utils = Common.Utils;

export interface ITxProposal {
  type: string;
  creatorName: string;
  createdOn: number;
  txid: string;
  id: string;
  walletId: string;
  creatorId: string;
  coin: string;
  network: string;
  message: string;
  payProUrl: string;
  from: string;
  changeAddress: string;
  inputs: any[];
  outputs: Array<{
    amount: number;
    address: string;
    toAddress?: string;
    message?: string;
    data?: string;
    gasLimit?: number;
    script?: string;
  }>;
  outputOrder: number;
  walletM: number;
  walletN: number;
  requiredSignatures: number;
  requiredRejections: number;
  status: string;
  actions: [];
  feeLevel: number;
  feePerKb: number;
  excludeUnconfirmedUtxos: boolean;
  addressType: string;
  customData: any;
  amount: string;
  fee: number;
  version: number;
  broadcastedOn: number;
  inputPaths: string;
  proposalSignature: string;
  proposalSignaturePubKey: string;
  proposalSignaturePubKeySig: string;
  signingMethod: string;
  lowFees: boolean;
  nonce?: number;
  gasPrice?: number;
  gasLimit?: number; // Backward compatibility for BWC <= 8.9.0
  data?: string; // Backward compatibility for BWC <= 8.9.0
  tokenAddress?: string;
  multisigContractAddress?: string;
  destinationTag?: string;
  invoiceID?: string;
  lockUntilBlockHeight?: number;
}

export class TxProposal {
  type: string;
  creatorName: string;
  createdOn: number;
  id: string;
  txid: string;
  walletId: string;
  creatorId: string;
  coin: string;
  network: string;
  message: string;
  payProUrl: string;
  from: string;
  changeAddress: any;
  inputs: any[];
  outputs: Array<{
    amount: number;
    address?: string;
    toAddress?: string;
    message?: string;
    data?: string;
    gasLimit?: number;
    script?: string;
    satoshis?: number;
  }>;
  outputOrder: number[];
  walletM: number;
  walletN: number;
  requiredSignatures: number;
  requiredRejections: number;
  status: string;
  actions: any[] = [];
  feeLevel: number;
  feePerKb: number;
  excludeUnconfirmedUtxos: boolean;
  addressType: string;
  customData: any;
  amount: string | number;
  fee: number;
  version: number;
  broadcastedOn: number;
  inputPaths: string | any[];
  proposalSignature: string;
  proposalSignaturePubKey: string;
  proposalSignaturePubKeySig: string;
  signingMethod: string;
  raw?: Array<string> | string;
  nonce?: number;
  gasPrice?: number;
  gasLimit?: number; // Backward compatibility for BWC <= 8.9.0
  data?: string; // Backward compatibility for BWC <= 8.9.0
  tokenAddress?: string;
  multisigContractAddress?: string;
  multisigTxId?: string;
  destinationTag?: string;
  invoiceID?: string;
  lockUntilBlockHeight?: number;

  static create(opts) {
    opts = opts || {};

    $.checkArgument(Utils.checkValueInCollection(opts.coin, Constants.COINS));
    $.checkArgument(Utils.checkValueInCollection(opts.network, Constants.NETWORKS));

    const x = new TxProposal();

    // allow creating legacy tx version == 3 only for testing
    if (opts.version) {
      $.checkArgument(opts.version >= 3);
    }

    // x.version = opts.version || 5; // DISABLED 2020-04-07
    x.version = opts.version || 3;
    $.checkState(x.version <= 3, 'Failed state: txp version 4 not allowed yet at <create()>');

    const now = Date.now();
    x.createdOn = Math.floor(now / 1000);
    x.id = opts.id || Uuid.v4();
    x.walletId = opts.walletId;
    x.creatorId = opts.creatorId;
    x.coin = opts.coin;
    x.network = opts.network;
    x.signingMethod = opts.signingMethod;
    x.message = opts.message;
    x.payProUrl = opts.payProUrl;
    x.changeAddress = opts.changeAddress;
    x.outputs = _.map(opts.outputs, output => {
      return _.pick(output, ['amount', 'toAddress', 'message', 'data', 'gasLimit', 'script']);
    });
    x.outputOrder = _.range(x.outputs.length + 1);
    if (!opts.noShuffleOutputs) {
      x.outputOrder = _.shuffle(x.outputOrder);
    }
    x.walletM = opts.walletM;
    x.walletN = opts.walletN;
    x.requiredSignatures = x.walletM;
    (x.requiredRejections = Math.min(x.walletM, x.walletN - x.walletM + 1)), (x.status = 'temporary');
    x.actions = [];
    x.feeLevel = opts.feeLevel;
    x.feePerKb = opts.feePerKb;
    x.excludeUnconfirmedUtxos = opts.excludeUnconfirmedUtxos;

    x.addressType = opts.addressType || (x.walletN > 1 ? Constants.SCRIPT_TYPES.P2SH : Constants.SCRIPT_TYPES.P2PKH);
    $.checkState(
      Utils.checkValueInCollection(x.addressType, Constants.SCRIPT_TYPES),
      'Failed state: addressType not in ScriptTypes at <create()>'
    );

    x.customData = opts.customData;

    x.amount = opts.amount ? opts.amount : x.getTotalAmount();

    x.setInputs(opts.inputs);
    x.fee = opts.fee;

    if (x.version === 4) {
      x.lockUntilBlockHeight = opts.lockUntilBlockHeight;
    }

    // Coin specific features

    // ETH
    x.gasPrice = opts.gasPrice;
    x.from = opts.from;
    x.nonce = opts.nonce;
    x.gasLimit = opts.gasLimit; // Backward compatibility for BWC <= 8.9.0
    x.data = opts.data; // Backward compatibility for BWC <= 8.9.0
    x.tokenAddress = opts.tokenAddress;
    x.multisigContractAddress = opts.multisigContractAddress;

    // XRP
    x.destinationTag = opts.destinationTag;
    x.invoiceID = opts.invoiceID;

    return x;
  }

  static fromObj(obj) {
    if (!(obj.version >= 3)) {
      return TxProposalLegacy.fromObj(obj);
    }

    const x = new TxProposal();

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
    x.actions = _.map(obj.actions, action => {
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
    x.signingMethod = obj.signingMethod;
    x.proposalSignaturePubKey = obj.proposalSignaturePubKey;
    x.proposalSignaturePubKeySig = obj.proposalSignaturePubKeySig;

    x.lockUntilBlockHeight = obj.lockUntilBlockHeight;

    // ETH
    x.gasPrice = obj.gasPrice;
    x.from = obj.from;
    x.nonce = obj.nonce;
    x.gasLimit = obj.gasLimit; // Backward compatibility for BWC <= 8.9.0
    x.data = obj.data; // Backward compatibility for BWC <= 8.9.0
    x.tokenAddress = obj.tokenAddress;
    x.multisigContractAddress = obj.multisigContractAddress;
    x.multisigTxId = obj.multisigTxId;

    // XRP
    x.destinationTag = obj.destinationTag;
    x.invoiceID = obj.invoiceID;

    if (x.status == 'broadcasted') {
      x.raw = obj.raw;
    }

    return x;
  }

  toObject() {
    const x: any = _.cloneDeep(this);
    x.isPending = this.isPending();
    return x;
  }

  setInputs(inputs) {
    this.inputs = inputs || [];
    this.inputPaths = _.map(inputs, 'path') || [];
  }

  _updateStatus() {
    if (this.status != 'pending') return;

    if (this.isRejected()) {
      this.status = 'rejected';
    } else if (this.isAccepted()) {
      this.status = 'accepted';
    }
  }

  getCurrentSignatures() {
    const acceptedActions = _.filter(this.actions, a => {
      return a.type == 'accept';
    });

    return _.map(acceptedActions, x => {
      return {
        signatures: x.signatures,
        xpub: x.xpub
      };
    });
  }

  getRawTx() {
    const t = ChainService.getBitcoreTx(this);
    return t.uncheckedSerialize();
  }

  /**
   * getTotalAmount
   *
   * @return {Number} total amount of all outputs excluding change output
   */
  getTotalAmount() {
    return _.sumBy(this.outputs, 'amount');
  }

  /**
   * getActors
   *
   * @return {String[]} copayerIds that performed actions in this proposal (accept / reject)
   */
  getActors() {
    return _.map(this.actions, 'copayerId');
  }

  /**
   * getApprovers
   *
   * @return {String[]} copayerIds that approved the tx proposal (accept)
   */
  getApprovers() {
    return _.map(
      _.filter(this.actions, a => {
        return a.type == 'accept';
      }),
      'copayerId'
    );
  }

  /**
   * getActionBy
   *
   * @param {String} copayerId
   * @return {Object} type / createdOn
   */
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

  sign(copayerId, signatures, xpub) {
    try {
      // Tests signatures are OK
      const tx = ChainService.getBitcoreTx(this);
      ChainService.addSignaturesToBitcoreTx(
        this.coin,
        tx,
        this.inputs,
        this.inputPaths,
        signatures,
        xpub,
        this.signingMethod
      );
      this.addAction(copayerId, 'accept', null, signatures, xpub);

      if (this.status == 'accepted') {
        this.raw = tx.uncheckedSerialize();
        this.txid = tx.id;
      }

      return true;
    } catch (e) {
      logger.debug(e);
      return false;
    }
  }

  reject(copayerId, reason) {
    this.addAction(copayerId, 'reject', reason);
  }

  isTemporary() {
    return this.status == 'temporary';
  }

  isPending() {
    return !_.includes(['temporary', 'broadcasted', 'rejected'], this.status);
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
    $.checkState(this.txid, 'Failed state: this.txid at <setBroadcasted()>');
    this.status = 'broadcasted';
    this.broadcastedOn = Math.floor(Date.now() / 1000);
  }
}
