import { Transactions } from 'crypto-wallet-core';
import _ from 'lodash';
import { ChainService } from '../chain/index';
import { TxProposalLegacy } from './txproposal_legacy';
import { TxProposalAction } from './txproposalaction';

const $ = require('preconditions').singleton();
const Uuid = require('uuid');
const log = require('npmlog');
log.debug = log.verbose;
log.disableColor();

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
  lowFees: boolean;
  nonce?: number;
  gasPrice?: number;
  gasLimit?: number; // Backward compatibility for BWC <= 8.9.0
  data?: string; // Backward compatibility for BWC <= 8.9.0
  tokenAddress?: string;
  destinationTag?: string;
  invoiceID?: string;
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
  raw?: Array<string> | string;
  nonce?: number;
  gasPrice?: number;
  gasLimit?: number; // Backward compatibility for BWC <= 8.9.0
  data?: string; // Backward compatibility for BWC <= 8.9.0
  tokenAddress?: string;
  destinationTag?: string;
  invoiceID?: string;

  static create(opts) {
    opts = opts || {};

    $.checkArgument(Utils.checkValueInCollection(opts.coin, Constants.COINS));
    $.checkArgument(
      Utils.checkValueInCollection(opts.network, Constants.NETWORKS)
    );

    const x = new TxProposal();

    x.version = 3;

    const now = Date.now();
    x.createdOn = Math.floor(now / 1000);
    x.id = opts.id || Uuid.v4();
    x.walletId = opts.walletId;
    x.creatorId = opts.creatorId;
    x.coin = opts.coin;
    x.network = opts.network;
    x.message = opts.message;
    x.payProUrl = opts.payProUrl;
    x.changeAddress = opts.changeAddress;
    x.outputs = _.map(opts.outputs, (output) => {
      return _.pick(output, ['amount', 'toAddress', 'message', 'data', 'gasLimit', 'script']);
    });
    x.outputOrder = _.range(x.outputs.length + 1);
    if (!opts.noShuffleOutputs) {
      x.outputOrder = _.shuffle(x.outputOrder);
    }
    x.walletM = opts.walletM;
    x.walletN = opts.walletN;
    x.requiredSignatures = x.walletM;
    (x.requiredRejections = Math.min(x.walletM, x.walletN - x.walletM + 1)),
      (x.status = 'temporary');
    x.actions = [];
    x.feeLevel = opts.feeLevel;
    x.feePerKb = opts.feePerKb;
    x.excludeUnconfirmedUtxos = opts.excludeUnconfirmedUtxos;

    x.addressType =
      opts.addressType ||
      (x.walletN > 1
        ? Constants.SCRIPT_TYPES.P2SH
        : Constants.SCRIPT_TYPES.P2PKH);
    $.checkState(
      Utils.checkValueInCollection(x.addressType, Constants.SCRIPT_TYPES)
    );

    x.customData = opts.customData;

    x.amount = opts.amount ? opts.amount : x.getTotalAmount();

    x.setInputs(opts.inputs);
    x.fee = opts.fee;

    // ETH
    x.gasPrice = opts.gasPrice;
    x.from = opts.from;
    x.nonce = opts.nonce;
    x.gasLimit = opts.gasLimit; // Backward compatibility for BWC <= 8.9.0
    x.data = opts.data; // Backward compatibility for BWC <= 8.9.0
    x.tokenAddress = opts.tokenAddress;

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
    x.actions = _.map(obj.actions, (action) => {
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

    // ETH
    x.gasPrice = obj.gasPrice;
    x.from = obj.from;
    x.nonce = obj.nonce;
    x.gasLimit = obj.gasLimit; // Backward compatibility for BWC <= 8.9.0
    x.data = obj.data; // Backward compatibility for BWC <= 8.9.0
    x.tokenAddress = obj.tokenAddress;

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

  /* this will build the Bitcoin-lib tx OR an adaptor for CWC transactions */
  _buildTx() {
    $.checkState(
      Utils.checkValueInCollection(this.addressType, Constants.SCRIPT_TYPES)
    );
    return ChainService.buildTx(this);
  }

  _getCurrentSignatures() {
    const acceptedActions = _.filter(this.actions, (a) => {
      return a.type == 'accept';
    });

    return _.map(acceptedActions, (x) => {
      return {
        signatures: x.signatures,
        xpub: x.xpub
      };
    });
  }

  getBitcoreTx() {
    const t = this._buildTx();
    const sigs = this._getCurrentSignatures();
    _.each(sigs, (x) => {
      ChainService.addSignaturesToBitcoreTx(this.coin, t, this.inputs, this.inputPaths, x.signatures, x.xpub);
    });

    return t;
  }

  getRawTx() {
    const t = this.getBitcoreTx();

    return t.uncheckedSerialize();
  }

  getEstimatedSizeForSingleInput() {
    switch (this.addressType) {
      case Constants.SCRIPT_TYPES.P2PKH:
        return 147;
      default:
      case Constants.SCRIPT_TYPES.P2SH:
        return this.requiredSignatures * 72 + this.walletN * 36 + 44;
    }
  }

  getEstimatedSize() {
    // Note: found empirically based on all multisig P2SH inputs and within m & n allowed limits.
    const safetyMargin = 0.02;

    const overhead = 4 + 4 + 9 + 9;
    const inputSize = this.getEstimatedSizeForSingleInput();
    const outputSize = 34;
    const nbInputs = this.inputs.length;
    const nbOutputs =
      (_.isArray(this.outputs) ? Math.max(1, this.outputs.length) : 1) + 1;

    const size = overhead + inputSize * nbInputs + outputSize * nbOutputs;

    return parseInt((size * (1 + safetyMargin)).toFixed(0));
  }

  getEstimatedFee() {
    $.checkState(_.isNumber(this.feePerKb));
    const fee = (this.feePerKb * this.getEstimatedSize()) / 1000;
    return parseInt(fee.toFixed(0));
  }

  estimateFee() {
    this.fee = this.getEstimatedFee();
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
      _.filter(this.actions, (a) => {
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
      const tx = this.getBitcoreTx();
      ChainService.addSignaturesToBitcoreTx(this.coin, tx, this.inputs, this.inputPaths, signatures, xpub);
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
    $.checkState(this.txid);
    this.status = 'broadcasted';
    this.broadcastedOn = Math.floor(Date.now() / 1000);
  }
}
