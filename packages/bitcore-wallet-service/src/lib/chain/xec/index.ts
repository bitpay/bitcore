import { BitcoreLibXec } from '@abcpros/crypto-wallet-core';
import BN from 'bignumber.js';
import { BigNumber } from 'bignumber.js';
import { ChronikClient } from 'chronik-client';
import _, { isNumber } from 'lodash';
import { Token } from 'typescript';
import { IChain } from '..';
import { BtcChain } from '../btc';
const config = require('../../../config');

const Errors = require('../../errors/errordefinitions');
const Common = require('../../common');
const Utils = Common.Utils;
const BCHJS = require('@abcpros/xpi-js');
const bchjs = new BCHJS({ restURL: '' });
const ecashaddr = require('ecashaddrjs');
const protocolPrefix = { livenet: 'ecash', testnet: 'ectest' };
export interface UtxoToken {
  addressInfo: IAddress;
  txid: string;
  outIdx: number;
  value: number;
  isNonSLP?: boolean;
  slpMeta?: any;
  tokenId?: string;
  amountToken?: number;
  tokenQty?: number;
  decimals?: number;
}

export interface IAddress {
  version: string;
  createdOn: number;
  address: string;
  walletId: string;
  isChange: boolean;
  path: string;
  publicKeys: string[];
  coin: string;
  network: string;
  type: string;
  hasActivity: any;
  beRegistered: boolean;
}

export interface TokenInfo {
  id: string;
  symbol: string;
  name: string;
  coin: string;
  decimals: number;
  documentHash?: string;
  documentUri: string;
}
export class XecChain extends BtcChain implements IChain {
  chronikClient: ChronikClient;

  constructor() {
    super(BitcoreLibXec);
    this.sizeEstimationMargin = config.bch?.sizeEstimationMargin ?? 0.01;
    this.inputSizeEstimationMargin = config.bch?.inputSizeEstimationMargin ?? 2;
    this.chronikClient = new ChronikClient(config.supportToken.xec.chronikClientUrl);
  }

  convertAddressToScriptPayload(address) {
    try {
      const protoXEC = protocolPrefix.livenet; // only support livenet
      const protoAddr: string = protoXEC + ':' + address;
      const { prefix, type, hash } = ecashaddr.decode(protoAddr);
      const cashAddress = ecashaddr.encode('bitcoincash', type, hash);
      return bchjs.Address.toHash160(cashAddress);
    } catch {
      return '';
    }
  }

  getChronikClient() {
    return this.chronikClient;
  }

  async getTokenInfo(tokenId) {
    const tx = await this.chronikClient.tx(tokenId);
    return {
      coin: 'xec',
      id: tx.slpTxData?.slpMeta.tokenId || '',
      symbol: tx.slpTxData?.genesisInfo?.tokenTicker || '',
      name: tx.slpTxData?.genesisInfo?.tokenName || '',
      documentUri: tx.slpTxData?.genesisInfo?.tokenDocumentUrl || '',
      documentHash: tx.slpTxData?.genesisInfo?.tokenDocumentHash || '',
      decimals:
        tx.slpTxData && tx.slpTxData.genesisInfo && isNumber(tx.slpTxData.genesisInfo.decimals)
          ? tx.slpTxData.genesisInfo.decimals
          : NaN
    } as TokenInfo;
  }

  async sendToken(wallet, mnemonic, tokenId, token, TOKENQTY, etokenAddress) {
    const tokenInfo = await this.getTokenInfo(tokenId);

    const rootSeed = await bchjs.Mnemonic.toSeed(mnemonic);
    let masterHDNode;
    masterHDNode = bchjs.HDNode.fromSeed(rootSeed);
    const rootPath = wallet.getRootPath() ? wallet.getRootPath() : "m/44'/1899'/0'";

    // HDNode of BIP44 account
    const account = bchjs.HDNode.derivePath(masterHDNode, rootPath);
    const change = bchjs.HDNode.derivePath(account, '0/0');

    const cashAddress = bchjs.HDNode.toCashAddress(change);
    const slpAddress = bchjs.HDNode.toSLPAddress(change);

    try {
      const utxos = await this.getUtxosToken(wallet);
      if (utxos.length === 0) throw new Error('No UTXOs to spend! Exiting.');

      const xecUtxos = _.filter(utxos, item => item.isNonSLP);

      if (xecUtxos.length === 0) {
        throw new Error('Wallet does not have a BCH UTXO to pay miner fees.');
      }
      const tokenUtxos = await this.getTokenUtxos(utxos, tokenInfo);

      if (tokenUtxos.length === 0) {
        throw new Error('No token UTXOs for the specified token could be found.');
      }

      // Choose a UTXO to pay for the transaction.
      const bchUtxo = this.findBiggestUtxo(xecUtxos);

      // BEGIN transaction construction.

      // instance of transaction builder
      let transactionBuilder;
      transactionBuilder = new bchjs.TransactionBuilder();
      // Add the BCH UTXO as input to pay for the transaction.
      const originalAmount = bchUtxo.value;
      transactionBuilder.addInput(bchUtxo.txid, bchUtxo.outIdx);

      // add each token UTXO as an input.
      for (let i = 0; i < tokenUtxos.length; i++) {
        transactionBuilder.addInput(tokenUtxos[i].txid, tokenUtxos[i].outIdx);
      }

      const txFee = 250;

      // amount to send back to the sending address. It's the original amount - 1 sat/byte for tx size
      const remainder = originalAmount - txFee - 546 * 2;
      if (remainder < 1) {
        throw new Error('Selected UTXO does not have enough satoshis');
      }
      TOKENQTY = TOKENQTY / Math.pow(10, tokenInfo.decimals);
      TOKENQTY = _.floor(TOKENQTY, tokenInfo.decimals);
      // Generate the OP_RETURN code.
      const slpSendObj = bchjs.SLP.TokenType1.generateSendOpReturn(tokenUtxos, TOKENQTY);
      const slpData = slpSendObj.script;
      // Add OP_RETURN as first output.
      transactionBuilder.addOutput(slpData, 0);

      // Send the token back to the same wallet if the user hasn't specified a
      // different address.
      if (!!etokenAddress) {
        // Send dust transaction representing tokens being sent.
        const { prefix, type, hash } = ecashaddr.decode(etokenAddress);
        const cashAdr = ecashaddr.encode('bitcoincash', type, hash);
        // const cashAdress = ecashaddr.encodeAddress('bitcoincash', type, hash, etokenAddress);
        transactionBuilder.addOutput(bchjs.SLP.Address.toLegacyAddress(cashAdr), 546);
      } else {
        transactionBuilder.addOutput(bchjs.SLP.Address.toLegacyAddress(cashAddress), 546);
      }

      // Return any token change back to the sender.
      if (slpSendObj.outputs > 1) {
        transactionBuilder.addOutput(bchjs.SLP.Address.toLegacyAddress(slpAddress), 546);
      }

      // Last output: send the BCH change back to the wallet.
      transactionBuilder.addOutput(bchjs.Address.toLegacyAddress(cashAddress), remainder);

      // Sign the transaction with the private key for the BCH UTXO paying the fees.
      let redeemScript;
      // Sign the transaction with the private key for the BCH UTXO paying the fees.

      const childIndex = (bchUtxo.addressInfo.path as string).replace(/m\//gm, '');
      const changeCash = bchjs.HDNode.derivePath(account, childIndex);
      let keyPairCash = bchjs.HDNode.toKeyPair(changeCash);
      transactionBuilder.sign(0, keyPairCash, redeemScript, transactionBuilder.hashTypes.SIGHASH_ALL, originalAmount);

      // Sign each token UTXO being consumed.
      for (let i = 0; i < tokenUtxos.length; i++) {
        const thisUtxo = tokenUtxos[i];
        const childIndex = (thisUtxo.addressInfo.path as string).replace(/m\//gm, '');
        let changeToken = bchjs.HDNode.derivePath(account, childIndex);
        let keyPairToken = bchjs.HDNode.toKeyPair(changeToken);
        transactionBuilder.sign(
          1 + i,
          keyPairToken,
          redeemScript,
          transactionBuilder.hashTypes.SIGHASH_ALL,
          thisUtxo.value
        );
      }

      // build tx
      const tx = transactionBuilder.build();

      // output rawhex
      const hex = tx.toHex();
      const txid = await this.broadcastRaw(wallet, hex, true).catch(e => {
        throw e;
      });
      return txid;
    } catch (e) {
      throw e;
    }
    // Get a UTXO
  }

  async burnToken(wallet, mnemonic: string, tokenId: string, TOKENQTY: number, splitTxId: string) {
    const tokenInfo = await this.getTokenInfo(tokenId);
    const rootSeed = await bchjs.Mnemonic.toSeed(mnemonic);
    // master HDNode
    let masterHDNode;
    masterHDNode = bchjs.HDNode.fromSeed(rootSeed);
    const rootPath = wallet.getRootPath() ? wallet.getRootPath() : "m/44'/1899'/0'";
    // HDNode of BIP44 account
    const account = bchjs.HDNode.derivePath(masterHDNode, rootPath);
    const change = bchjs.HDNode.derivePath(account, '0/0');

    const cashAddress = bchjs.HDNode.toCashAddress(change);
    const slpAddress = bchjs.HDNode.toSLPAddress(change);

    // Get a UTXO
    const utxos: UtxoToken[] = await this.getUtxosToken(wallet);

    if (utxos.length === 0) throw new Error('No UTXOs to spend! Exiting.');

    const xecUtxos = _.filter(utxos, item => item.isNonSLP);

    if (xecUtxos.length === 0) {
      throw new Error('Wallet does not have a BCH UTXO to pay miner fees.');
    }
    const tokenUtxos = await this.getTokenUtxos(utxos, tokenInfo);

    if (tokenUtxos.length === 0) {
      throw new Error('No token UTXOs for the specified token could be found.');
    }

    const tokenUtxoSelected = tokenUtxos.find(utxo => utxo.txid === splitTxId);

    // Choose a UTXO to pay for the transaction.
    const bchUtxo = this.findBiggestUtxo(xecUtxos);
    // console.log(`bchUtxo: ${JSON.stringify(bchUtxo, null, 2)}`);

    // Generate the OP_RETURN code.
    TOKENQTY = TOKENQTY / Math.pow(10, tokenInfo.decimals);
    TOKENQTY = _.floor(TOKENQTY, tokenInfo.decimals);
    const slpData = this.buildBurnOpReturn(tokenInfo.id, new BigNumber(TOKENQTY).times(10 ** tokenInfo.decimals));
    // BEGIN transaction construction.

    // instance of transaction builder
    let transactionBuilder;
    transactionBuilder = new bchjs.TransactionBuilder();

    // Add the BCH UTXO as input to pay for the transaction.
    const originalAmount = bchUtxo.value;
    transactionBuilder.addInput(bchUtxo.txid, bchUtxo.outIdx);

    // add each token UTXO as an input.
    transactionBuilder.addInput(tokenUtxoSelected.txid, tokenUtxoSelected.outIdx);

    let byteCount = bchjs.BitcoinCash.getByteCount({ P2PKH: 2 }, { P2PKH: 2 });
    byteCount += slpData.length;
    // Account for difference in inputs and outputs
    // byteCount += 546 * (1 - 2);
    // amount to send back to the sending address. It's the original amount - 1 sat/byte for tx size
    const remainder = originalAmount - byteCount;
    if (remainder < 0) {
      throw new Error('Selected UTXO does not have enough satoshis');
    }

    // Add OP_RETURN as first output.
    transactionBuilder.addOutput(slpData, 0);

    if (remainder > 546) {
      // Last output: send the BCH change back to the wallet.
      transactionBuilder.addOutput(bchjs.Address.toLegacyAddress(cashAddress), remainder);
    }

    // Sign the transaction with the private key for the BCH UTXO paying the fees.
    let redeemScript;
    const childIndex = (bchUtxo.addressInfo.path as string).replace(/m\//gm, '');
    const changeCash = bchjs.HDNode.derivePath(account, childIndex);
    let keyPairCash = bchjs.HDNode.toKeyPair(changeCash);
    transactionBuilder.sign(0, keyPairCash, redeemScript, transactionBuilder.hashTypes.SIGHASH_ALL, originalAmount);

    // Sign each token UTXO being consumed.
    const thisUtxo = tokenUtxoSelected;
    const childIndex2 = (thisUtxo.addressInfo.path as string).replace(/m\//gm, '');
    let changeToken = bchjs.HDNode.derivePath(account, childIndex2);
    let keyPairToken = bchjs.HDNode.toKeyPair(changeToken);
    transactionBuilder.sign(1, keyPairToken, redeemScript, transactionBuilder.hashTypes.SIGHASH_ALL, thisUtxo.value);

    // build tx
    const tx = transactionBuilder.build();

    // output rawhex
    const hex = tx.toHex();
    const txid = await this.broadcastRaw(wallet, hex, true);
    return txid;
  }

  private findBiggestUtxo(utxos: UtxoToken[]) {
    let largestAmount = 0;
    let largestIndex = 0;

    for (var i = 0; i < utxos.length; i++) {
      const thisUtxo = utxos[i];

      if (thisUtxo.value > largestAmount) {
        largestAmount = thisUtxo.value;
        largestIndex = i;
      }
    }
    return utxos[largestIndex];
  }

  getTokenUtxos(utxos: UtxoToken[], tokenInfo: TokenInfo): UtxoToken[] {
    const tokenUtxos = [];
    _.forEach(utxos, item => {
      const slpMeta = _.get(item, 'slpMeta', undefined);
      // UTXO is not a minting baton.
      if (item.amountToken && slpMeta.tokenId && slpMeta.tokenId === tokenInfo.id && slpMeta.txType != 'MINT') {
        const tokenUtxo: UtxoToken = {
          addressInfo: item.addressInfo,
          txid: item.txid,
          outIdx: item.outIdx,
          value: item.value,
          decimals: tokenInfo.decimals,
          tokenId: tokenInfo.id,
          tokenQty: item.amountToken / Math.pow(10, tokenInfo.decimals),
          amountToken: item.amountToken
        };
        tokenUtxos.push(tokenUtxo);
      }
    });
    return tokenUtxos;
  }

  public broadcastRaw(wallet, raw, ischronik) {
    return new Promise((resolve, reject) => {
      wallet.broadcastRawTx(
        {
          rawTx: raw,
          network: 'livenet',
          coin: wallet.credentials.coin,
          ischronik
        },
        (err, txid) => {
          if (err || !txid) return reject(err ? err : 'No Tokens');
          return resolve(txid);
        }
      );
    });
  }

  getUtxosToken(wallet): Promise<any> {
    return new Promise((resolve, reject) => {
      wallet.getUtxosToken(
        {
          coin: 'xec'
        },
        (err, resp) => {
          if (err || !resp || !resp.length) reject(err ? err : 'No UTXOs');
          resolve(resp);
        }
      );
    });
  }
  convertFeePerKb(p, feePerKb) {
    return [p, Utils.strip(feePerKb * 1e2)];
  }

  getSizeSafetyMargin(opts: any): number {
    return 0;
  }

  getInputSizeSafetyMargin(opts: any): number {
    return 0;
  }

  validateAddress(wallet, inaddr, opts) {
    const A = BitcoreLibXec.Address;
    let addr: {
      network?: string;
      toString?: (cashAddr: boolean) => string;
    } = {};
    try {
      addr = new A(inaddr);
    } catch (ex) {
      throw Errors.INVALID_ADDRESS;
    }
    if (addr.network.toString() != wallet.network) {
      throw Errors.INCORRECT_ADDRESS_NETWORK;
    }
    return;
  }

  pushdata(buf: Buffer | Uint8Array): Buffer {
    if (buf.length === 0) {
      return Buffer.from([0x4c, 0x00]);
    } else if (buf.length < 0x4e) {
      return Buffer.concat([Buffer.from([buf.length]), buf]);
    } else if (buf.length < 0xff) {
      return Buffer.concat([Buffer.from([0x4c, buf.length]), buf]);
    } else if (buf.length < 0xffff) {
      const tmp = Buffer.allocUnsafe(2);
      tmp.writeUInt16LE(buf.length, 0);
      return Buffer.concat([Buffer.from([0x4d]), tmp, buf]);
    } else if (buf.length < 0xffffffff) {
      const tmp = Buffer.allocUnsafe(4);
      tmp.writeUInt32LE(buf.length, 0);
      return Buffer.concat([Buffer.from([0x4e]), tmp, buf]);
    } else {
      throw new Error('does not support bigger pushes yet');
    }
  }
  6;

  BNToInt64BE(bn: BN): Buffer {
    if (!bn.isInteger()) {
      throw new Error('bn not an integer');
    }

    if (!bn.isPositive()) {
      throw new Error('bn not positive integer');
    }

    const h = bn.toString(16);
    if (h.length > 16) {
      throw new Error('bn outside of range');
    }

    return Buffer.from(h.padStart(16, '0'), 'hex');
  }

  buildBurnOpReturn(tokenId: string, burnQuantity: BN): Buffer {
    const tokenIdHex = Buffer.from(tokenId, 'hex');
    const buf = Buffer.concat([
      Buffer.from([0x6a]), // OP_RETURN
      this.pushdata(Buffer.from('SLP\0')),
      this.pushdata(Buffer.from([0x01])), // versionType
      this.pushdata(Buffer.from('BURN')),
      this.pushdata(tokenIdHex),
      this.pushdata(this.BNToInt64BE(burnQuantity))
    ]);
    return buf;
  }
}
