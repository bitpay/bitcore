import { Utils as CWCUtils } from '@bitpay-labs/crypto-wallet-core';
import _ from 'lodash';
import { singleton } from 'preconditions';
import Uuid from 'uuid';
import { ChainService } from '../chain/index';
import { Common } from '../common';
import logger from '../logger';
import { type IAddress } from './address';
import { type ITxNote, TxNote } from './txnote';
import { type ITxProposalLegacy, TxProposalLegacy } from './txproposal_legacy';
import { TxProposalAction } from './txproposalaction';

const $ = singleton();
const { Constants, Defaults, Utils } = Common;

type TxProposalStatus = 'temporary' | 'pending' | 'accepted' | 'rejected' | 'broadcasted';

export interface ITxProposal<NumberType = number> {
  version: number;
  type?: string;
  createdOn: number;
  txid: string;
  txids?: Array<string>;
  id: string;
  walletId: string;
  creatorId: string;
  coin: string;
  chain: string;
  network: string;
  message: string;
  payProUrl?: string;
  from: string;
  sendMax?: boolean;
  changeAddress?: Partial<IAddress>;
  escrowAddress?: Partial<IAddress>;
  inputs: any[];
  outputs: Array<{
    amount: NumberType;
    address?: string;
    toAddress?: string;
    sourceAddress?: string;
    message?: string;
    data?: string;
    gasLimit?: NumberType;
    script?: string;
    satoshis?: NumberType;
    tag?: number;
  }>;
  outputOrder: number[];
  walletM: number;
  walletN: number;
  requiredSignatures: number;
  requiredRejections: number;
  status: TxProposalStatus;
  actions: any[];
  feeLevel: string;
  feePerKb: NumberType;
  excludeUnconfirmedUtxos: boolean;
  addressType: string;
  customData: any;
  amount: NumberType;
  fee: NumberType;
  broadcastedOn: number;
  inputPaths: string | any[];
  proposalSignature: string;
  proposalSignaturePubKey: string;
  proposalSignaturePubKeySig: string;
  signingMethod: string;
  lowFees?: boolean;
  raw?: Array<string> | string;
  nonce?: NumberType | string;
  deferNonce?: boolean;
  gasPrice?: NumberType;
  maxGasFee?: NumberType;
  priorityGasFee?: NumberType;
  txType?: number | string;
  gasLimit?: NumberType; // Backward compatibility for BWC <= 8.9.0
  data?: string; // Backward compatibility for BWC <= 8.9.0
  tokenAddress?: string;
  multisigContractAddress?: string;
  multisigTxId?: string;
  destinationTag?: string;
  invoiceID?: string;
  flags?: number; // XRP account flags to toggle
  lockUntilBlockHeight?: NumberType;
  instantAcceptanceEscrow?: NumberType;
  isTokenSwap?: boolean;
  multiSendContractAddress?: string;
  enableRBF?: boolean;
  replaceTxByFee?: boolean;
  multiTx?: boolean; // proposal contains multiple transactions
  space?: NumberType;
  nonceAddress?: string;
  blockHash?: string;
  blockHeight?: NumberType;
  category?: string;
  priorityFee?: NumberType;
  computeUnits?: NumberType;
  memo?: string;
  fromAta?: string;
  decimals?: number;
  refreshOnPublish?: boolean;
  prePublishRaw?: string;
  
  // Non-persistent fields - populated on fetch
  creatorName: string;
  derivationStrategy?: string;
  note?: ITxNote;
}

export type NumberFormat = 'hex' | 'number' | 'string' | 'bigint';

export class TxProposal<NumberType = number> implements ITxProposal<NumberType> {
  version: number;
  type?: string;
  createdOn: number;
  id: string;
  txid: string;
  txids?: Array<string>;
  walletId: string;
  creatorId: string;
  coin: string;
  chain: string;
  network: string;
  message: string;
  payProUrl?: string;
  from: string;
  sendMax?: boolean;
  changeAddress?: Partial<IAddress>;
  escrowAddress?: Partial<IAddress>;
  inputs: any[];
  outputs: Array<{
    amount: NumberType;
    address?: string;
    toAddress?: string;
    sourceAddress?: string;
    message?: string;
    data?: string;
    gasLimit?: NumberType;
    script?: string;
    satoshis?: NumberType;
    tag?: number;
  }>;
  outputOrder: number[];
  walletM: number;
  walletN: number;
  requiredSignatures: number;
  requiredRejections: number;
  status: TxProposalStatus;
  actions: any[] = [];
  feeLevel: string;
  feePerKb: NumberType;
  excludeUnconfirmedUtxos: boolean;
  addressType: string;
  customData: any;
  amount: NumberType;
  fee: NumberType;
  broadcastedOn: number;
  inputPaths: string | any[];
  proposalSignature: string;
  proposalSignaturePubKey: string;
  proposalSignaturePubKeySig: string;
  signingMethod: string;
  lowFees?: boolean;
  raw?: Array<string> | string;
  nonce?: NumberType;
  deferNonce?: boolean;
  gasPrice?: NumberType;
  maxGasFee?: NumberType;
  priorityGasFee?: NumberType;
  txType?: number | string;
  gasLimit?: NumberType; // Backward compatibility for BWC <= 8.9.0
  data?: string; // Backward compatibility for BWC <= 8.9.0
  tokenAddress?: string;
  multisigContractAddress?: string;
  multisigTxId?: string;
  destinationTag?: string;
  invoiceID?: string;
  flags?: number; // XRP account flags to toggle
  lockUntilBlockHeight?: NumberType;
  instantAcceptanceEscrow?: NumberType;
  isTokenSwap?: boolean;
  multiSendContractAddress?: string;
  enableRBF?: boolean;
  replaceTxByFee?: boolean;
  multiTx?: boolean;
  space?: NumberType;
  nonceAddress?: string;
  blockHash?: string;
  blockHeight?: NumberType;
  category?: string;
  priorityFee?: NumberType;
  computeUnits?: NumberType;
  memo?: string;
  fromAta?: string;
  decimals?: number;
  refreshOnPublish?: boolean;
  prePublishRaw?: string;
  
  // Non-persistent fields - populated on fetch
  creatorName: string;
  derivationStrategy?: string;
  note?: TxNote;

  static create(opts) {
    opts = opts || {};

    const chain = opts.chain?.toLowerCase() || Utils.getChain(opts.coin); // getChain -> backwards compatibility
    $.checkArgument(Utils.checkValueInCollection(opts.network, Constants.NETWORKS[chain]), `Invalid network: ${opts.network} at TxProposal.create()`);

    const x = new TxProposal();

    // allow creating legacy tx version == 3 only for testing
    if (opts.version) {
      $.checkArgument(opts.version >= 3);
    }

    // x.version = opts.version || 5; // DISABLED 2020-04-07
    x.version = opts.version || 3;
    $.checkState(x.version <= 3, 'Failed state: txp version 4 not allowed yet at TxProposal.create()');

    const now = Date.now();
    x.createdOn = Math.floor(now / 1000);
    x.id = opts.id || Uuid.v4();
    x.walletId = opts.walletId;
    x.creatorId = opts.creatorId;
    x.coin = opts.coin;
    x.chain = chain;
    x.network = opts.network;
    x.signingMethod = opts.signingMethod;
    x.message = opts.message;
    x.payProUrl = opts.payProUrl;
    x.sendMax = opts.sendMax;
    x.changeAddress = opts.changeAddress;
    x.escrowAddress = opts.escrowAddress;
    x.instantAcceptanceEscrow = opts.instantAcceptanceEscrow;
    x.outputs = (opts.outputs || []).map(output => {
      const out: any = {};
      if (output.amount !== undefined) out.amount = output.amount;
      if (output.toAddress !== undefined) out.toAddress = output.toAddress;
      if (output.sourceAddress !== undefined) out.sourceAddress = output.sourceAddress;
      if (output.message !== undefined) out.message = output.message;
      if (output.data !== undefined) out.data = output.data;
      if (output.gasLimit !== undefined) out.gasLimit = output.gasLimit;
      if (output.script !== undefined) out.script = output.script;
      if (output.tag !== undefined) out.tag = output.tag;
      return out; 
    });
    let numOutputs = x.outputs.length;
    if (!opts.multiTx) {
      numOutputs++;
    }
    if (x.instantAcceptanceEscrow) {
      numOutputs++;
    }
    x.outputOrder = _.range(numOutputs);
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
    // BTC
    x.enableRBF = opts.enableRBF;
    x.replaceTxByFee = opts.replaceTxByFee;

    // ETH
    x.gasPrice = opts.gasPrice; // type 0 txs
    x.maxGasFee = opts.maxGasFee; // type 2 txs
    x.priorityGasFee = opts.priorityGasFee; // type 2 txs
    x.txType = opts.txType;
    x.from = opts.from;
    x.nonce = opts.nonce;
    x.deferNonce = opts.deferNonce;
    x.gasLimit = opts.gasLimit; // Backward compatibility for BWC <= 8.9.0
    x.data = opts.data; // Backward compatibility for BWC <= 8.9.0
    x.tokenAddress = opts.tokenAddress;
    x.multiSendContractAddress = opts.multiSendContractAddress;
    x.isTokenSwap = opts.isTokenSwap;
    x.multisigContractAddress = opts.multisigContractAddress;

    // XRP
    x.destinationTag = opts.destinationTag;
    x.invoiceID = opts.invoiceID;
    x.multiTx = opts.multiTx; // proposal contains multiple transactions
    x.flags = opts.flags; // XRP account flags to toggle
    
    // SOL
    x.space = opts.space; // space to allocate for account creation
    x.blockHash = opts.blockHash; // recent block hash  required for tx creation
    x.blockHeight = opts.blockHeight; // max valid block height required for legacy tx creation
    x.nonceAddress = opts.nonceAddress; // account address mantaining latest nonce
    x.category = opts.category; // kind of transaction: transfer, account creation, nonce creation, etc
    x.computeUnits = opts.computeUnits;
    x.memo = opts.memo;
    x.fromAta = opts.fromAta;
    x.decimals = opts.decimals;
    x.priorityFee = opts.priorityFee;

    x.refreshOnPublish = opts.refreshOnPublish;

    return x;
  }

  static fromObj(obj: Partial<ITxProposal>): TxProposal;
  static fromObj(obj: Partial<ITxProposalLegacy>): TxProposalLegacy;
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
    x.creatorName = obj.creatorName;
    x.coin = obj.coin || Defaults.COIN;
    x.chain = obj.chain?.toLowerCase() || Utils.getChain(x.coin); // getChain -> backwards compatibility
    x.network = obj.network;
    x.outputs = obj.outputs;
    x.amount = obj.amount;
    x.message = obj.message;
    x.payProUrl = obj.payProUrl;
    x.derivationStrategy = obj.derivationStrategy;
    x.sendMax = obj.sendMax;
    x.changeAddress = obj.changeAddress;
    x.escrowAddress = obj.escrowAddress;
    x.instantAcceptanceEscrow = obj.instantAcceptanceEscrow;
    x.inputs = obj.inputs;
    x.walletM = obj.walletM;
    x.walletN = obj.walletN;
    x.requiredSignatures = obj.requiredSignatures;
    x.requiredRejections = obj.requiredRejections;
    x.status = obj.status;
    x.txid = obj.txid;
    x.txids = obj.txids;
    x.broadcastedOn = obj.broadcastedOn;
    x.inputPaths = obj.inputPaths;
    x.actions = (obj.actions || []).map(action => TxProposalAction.fromObj(action));
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

    // BTC
    x.enableRBF = obj.enableRBF;
    x.replaceTxByFee = obj.replaceTxByFee;

    // ETH
    x.gasPrice = obj.gasPrice;
    x.maxGasFee = obj.maxGasFee; // type 2 txs
    x.priorityGasFee = obj.priorityGasFee; // type 2 txs
    x.txType = obj.txType;
    x.from = obj.from;
    x.nonce = obj.nonce;
    x.deferNonce = obj.deferNonce;
    x.gasLimit = obj.gasLimit; // Backward compatibility for BWC <= 8.9.0
    x.data = obj.data; // Backward compatibility for BWC <= 8.9.0
    x.tokenAddress = obj.tokenAddress;
    x.isTokenSwap = obj.isTokenSwap;
    x.multiSendContractAddress = obj.multiSendContractAddress;
    x.multisigContractAddress = obj.multisigContractAddress;
    x.multisigTxId = obj.multisigTxId;

    // XRP
    x.destinationTag = obj.destinationTag;
    x.invoiceID = obj.invoiceID;
    x.multiTx = obj.multiTx;
    x.flags = obj.flags;

    // SOL
    x.space = obj.space; // space to allocate for account creation
    x.blockHash = obj.blockHash; // recent block hash  required for tx creation
    x.blockHeight = obj.blockHeight; // max valid block height required for legacy tx creation
    x.nonceAddress = obj.nonceAddress; // account address mantaining latest nonce
    x.category = obj.category; // kind of transaction: transfer, account creation, nonce creation, etc
    x.computeUnits = obj.computeUnits;
    x.memo = obj.memo;
    x.fromAta = obj.fromAta;
    x.decimals = obj.decimals;
    x.priorityFee = obj.priorityFee;

    x.refreshOnPublish = obj.refreshOnPublish;
    x.prePublishRaw = obj.prePublishRaw;

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
    this.inputPaths = this.inputs.map(input => input.path);
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
    const acceptedActions = this.actions.filter(a => a.type == 'accept');

    const uniqueXpubs = new Set();
    const signatures = [];
    for (const a of acceptedActions) {
      // TSS will have multiple accept actions with the same xpub/signature (different copayerIds)
      if (uniqueXpubs.has(a.xpub)) continue;
      uniqueXpubs.add(a.xpub);
      signatures.push({
        signatures: a.signatures,
        xpub: a.xpub
      });
    }
    return signatures;
  }

  getRawTx(numberFormat?: NumberFormat) {
    // Casting numberFormat to 'number' is to sidestep TS errors, but is not necessarily true.
    const txp = numberFormat ? TxProposal.formatNumbers(this, numberFormat as 'number') : this as TxProposal<number>;
    const t = ChainService.getBitcoreTx(txp);
    return t.uncheckedSerialize();
  }

  /**
   * getTotalAmount
   *
   * @return {Number} total amount of all outputs excluding change output
   */
  getTotalAmount() {
    return Number(((this as TxProposal<number>).outputs || []).reduce((total, o) => total += BigInt(o.amount), 0n));
  }

  /**
   * getActors
   *
   * @return {String[]} copayerIds that performed actions in this proposal (accept / reject)
   */
  getActors() {
    return (this.actions || []).map(a => a.copayerId);
  }

  /**
   * getApprovers
   *
   * @return {String[]} copayerIds that approved the tx proposal (accept)
   */
  getApprovers() {
    return (this.actions || [])
      .filter(a => a.type == 'accept')
      .map(a => a.copayerId);
  }

  /**
   * getActionBy
   *
   * @param {String} copayerId
   * @return {Object} type / createdOn
   */
  getActionBy(copayerId) {
    return (this.actions || []).find(a => a.copayerId == copayerId);
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

  sign(copayerId, signatures, xpub, numberFormat?: NumberFormat) {
    try {
      // numberFormat as 'number' is to sidestep TS errors, but is not necessarily true.
      const txp = numberFormat ? TxProposal.formatNumbers(this, numberFormat as 'number') : this as TxProposal<number>;
      const tx = ChainService.getBitcoreTx(txp);
      ChainService.addSignaturesToBitcoreTx(
        this.chain,
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
        if (this.multiTx) {
          this.txids = tx?.txids && tx.txids() || [tx.id];
        }
      }

      return true;
    } catch (e) {
      logger.debug('%o', e);
      return false;
    }
  }

  reject(copayerId, reason) {
    this.addAction(copayerId, 'reject', reason);
  }

  isRepublishEnabled() {
    return !!this.refreshOnPublish;
  }

  hasMutableTxData() {
    return this.isRepublishEnabled() || !!this.deferNonce;
  }

  isTemporary() {
    return this.status === 'temporary';
  }

  isPending() {
    return !['temporary', 'broadcasted', 'rejected'].includes(this.status);
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

  
  /**
   * Replaces tx-building number values with the specified number format.
   * This is to ensure consistency across BWC and BWS when handling large numbers, especially for chains like ETH and SOL.
   * @param {TxProposal|ITxProposal} txp Transaction Proposal
   * @param {'number'|'string'|'bigint'|'hex'} numberFormat The desired number format for the tx-building values. Can be 'number', 'string', 'bigint', or 'hex'.
   */
  static formatNumbers<T>(txp: TxProposal<T>, numberFormat: 'string'): TxProposal<string>;
  static formatNumbers<T>(txp: TxProposal<T>, numberFormat: 'hex'): TxProposal<string>;
  static formatNumbers<T>(txp: TxProposal<T>, numberFormat: 'bigint'): TxProposal<bigint>;
  static formatNumbers<T>(txp: TxProposal<T>, numberFormat: 'number'): TxProposal<number>;
  static formatNumbers<T>(txp: ITxProposal<T>, numberFormat: 'string'): ITxProposal<string>;
  static formatNumbers<T>(txp: ITxProposal<T>, numberFormat: 'hex'): ITxProposal<string>;
  static formatNumbers<T>(txp: ITxProposal<T>, numberFormat: 'bigint'): ITxProposal<bigint>;
  static formatNumbers<T>(txp: ITxProposal<T>, numberFormat: 'number'): ITxProposal<number>;
  static formatNumbers<T>(txp: TxProposal<T> | ITxProposal<T>, numberFormat: NumberFormat = 'number') {
    let convertFn;
    switch (numberFormat) {
      case 'number':
        convertFn = parseInt;
        break;
      case 'string':
        convertFn = (n) => typeof n === 'string' && n.startsWith('0x') ? BigInt(n).toString() : n.toString();
        break;
      case 'hex':
        convertFn = (n) => CWCUtils.toHex(n);
        break;
      case 'bigint':
        convertFn = (n) => BigInt(n);
        break;
      default:
        logger.warn(`Invalid numberFormat: ${numberFormat}, no conversion will be applied to tx proposal ${txp.id}`);
        return txp;
    }

    const primitiveTypes = new Set(['number', 'string', 'bigint']);
    const convert = (key, value) => {
      if ((numberFormat === 'hex' || typeof value !== numberFormat) && primitiveTypes.has(typeof value)) {
        try {
          value = convertFn(value);
        } catch (e) {
          logger.warn(`Failed to convert ${txp.id} > ${key} with value ${value} to ${numberFormat}: ${e.message}`);
        }
      }
      return value;
    };

    const _txp = txp instanceof TxProposal ? TxProposal.fromObj(txp.toObject()) : TxProposal.fromObj(txp as ITxProposal<number>).toObject();

    const topKeys = ['amount', 'feePerKb', 'fee', 'nonce', 'gasPrice', 'maxGasFee', 'priorityGasFee', 'gasLimit', 'lockUntilBlockHeight', 'instantAcceptanceEscrow', 'space', 'blockHeight', 'computeUnits', 'decimals'];
    for (const key of topKeys) {
      const value = _txp[key];
      _txp[key] = convert(key, value);
    }

    const outputKeys = ['amount', 'gasLimit', 'satoshis'];
    for (let i = 0; i < _txp.outputs.length; i++) {
      for (const key of outputKeys) {
        const value = _txp.outputs[i][key];
        _txp.outputs[i][key] = convert(`output.${i}.${key}`, value);
      }
    }

    return _txp;
  }
}
