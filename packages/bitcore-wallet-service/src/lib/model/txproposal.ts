import { Transactions } from 'crypto-wallet-core';
import _ from 'lodash';
import { TxProposalLegacy } from './txproposal_legacy';
import { TxProposalAction } from './txproposalaction';

const $ = require('preconditions').singleton();
const Uuid = require('uuid');
const log = require('npmlog');
log.debug = log.verbose;
log.disableColor();

const Bitcore = {
  btc: require('bitcore-lib'),
  bch: require('bitcore-lib-cash'),
  eth: require('bitcore-lib')
};

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
  gasLimit?: number;
  gasPrice?: number;
  data?: string;
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
  raw?: any;
  nonce?: number;
  gasLimit?: number;
  gasPrice?: number;
  data?: string;

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
      return _.pick(output, ['amount', 'toAddress', 'message', 'script']);
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

    x.gasLimit = opts.gasLimit;
    x.gasPrice = opts.gasPrice;
    x.from = opts.from;
    x.nonce = opts.nonce;
    x.data = opts.data;

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

    x.gasLimit = obj.gasLimit;
    x.gasPrice = obj.gasPrice;
    x.from = obj.from;
    x.nonce = obj.nonce;
    x.data = obj.data;

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

    if (!Constants.UTXO_COINS[this.coin.toUpperCase()]) {
      const rawTx = Transactions.create({
        ...this,
        chain: this.coin.toUpperCase(),
        recipients: [{ address: this.outputs[0].toAddress, amount: this.amount}],
        fee: this.gasPrice
      });
      return {
        uncheckedSerialize: () => rawTx,
        txid: () => this.txid,
        toObject: () => {
          let ret = _.clone(this);
          ret.outputs[0].satoshis = ret.outputs[0].amount;
          return ret;
        },
        getFee: () => {
          return this.fee;
        },
        getChangeOutput: () => null,

      };
    } else {
      const t = new Bitcore[this.coin].Transaction();

      switch (this.addressType) {
        case Constants.SCRIPT_TYPES.P2SH:
          _.each(this.inputs, (i) => {
            $.checkState(i.publicKeys, 'Inputs should include public keys');
            t.from(i, i.publicKeys, this.requiredSignatures);
          });
          break;
        case Constants.SCRIPT_TYPES.P2PKH:
          t.from(this.inputs);
          break;
      }

      _.each(this.outputs, (o) => {
        $.checkState(
          o.script || o.toAddress,
          'Output should have either toAddress or script specified'
        );
        if (o.script) {
          t.addOutput(
            new Bitcore[this.coin].Transaction.Output({
              script: o.script,
              satoshis: o.amount
            })
          );
        } else {
          t.to(o.toAddress, o.amount);
        }
      });

      t.fee(this.fee);

      if (this.changeAddress) {
        t.change(this.changeAddress.address);
      }

      // Shuffle outputs for improved privacy
      if (t.outputs.length > 1) {
        const outputOrder = _.reject(this.outputOrder, (order: number) => {
          return order >= t.outputs.length;
        });
        $.checkState(t.outputs.length == outputOrder.length);
        t.sortOutputs((outputs) => {
          return _.map(outputOrder, (i) => {
            return outputs[i];
          });
        });
      }

      // Validate actual inputs vs outputs independently of Bitcore
      const totalInputs = _.sumBy(t.inputs, 'output.satoshis');
      const totalOutputs = _.sumBy(t.outputs, 'satoshis');

      $.checkState(
        totalInputs > 0 && totalOutputs > 0 && totalInputs >= totalOutputs,
        'not-enought-inputs'
      );
      $.checkState(
        totalInputs - totalOutputs <= Defaults.MAX_TX_FEE[this.coin],
        'fee-too-high'
      );

      return t;
    }
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
      this._addSignaturesToBitcoreTx(t, x.signatures, x.xpub);
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

  _addSignaturesToBitcoreTxBitcoin(tx, signatures, xpub) {
    const bitcore = Bitcore[this.coin];

    if (signatures.length != this.inputs.length)
      throw new Error('Number of signatures does not match number of inputs');

    let i = 0;
    const x = new bitcore.HDPublicKey(xpub);

    _.each(signatures, (signatureHex) => {
      try {
        const signature = bitcore.crypto.Signature.fromString(signatureHex);
        const pub = x.deriveChild(this.inputPaths[i]).publicKey;
        const s = {
          inputIndex: i,
          signature,
          sigtype:
            // tslint:disable-next-line:no-bitwise
            bitcore.crypto.Signature.SIGHASH_ALL |
            bitcore.crypto.Signature.SIGHASH_FORKID,
          publicKey: pub
        };
        tx.inputs[i].addSignature(tx, s);
        i++;
      } catch (e) { }
    });

    if (i != tx.inputs.length) throw new Error('Wrong signatures');
  }

  _addSignaturesToBitcoreTx(tx, signatures, xpub) {
    switch (this.coin) {
      case 'eth':
        const raw = Transactions.applySignature({
          chain: 'ETH',
          tx: tx.uncheckedSerialize(),
          signature: signatures[0],
        });
        tx.uncheckedSerialize = () => raw ;

        // bitcore users id for txid...
        tx.id = Transactions.getHash({ tx: raw, chain: this.coin.toUpperCase() });
        break;
      default:
        return this._addSignaturesToBitcoreTxBitcoin(tx, signatures, xpub);
    }
  }

  sign(copayerId, signatures, xpub) {
    try {
      // Tests signatures are OK
      const tx = this.getBitcoreTx();
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
