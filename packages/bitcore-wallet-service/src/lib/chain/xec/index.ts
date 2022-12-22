import { BitcoreLibXec } from '@abcpros/crypto-wallet-core';
import { ChronikClient } from 'chronik-client';
import _ from 'lodash';
import { IChain } from '..';
import { BtcChain } from '../btc';
const config = require('../../../config');

const Errors = require('../../errors/errordefinitions');
const Common = require('../../common');
const Utils = Common.Utils;
const BCHJS = require('@abcpros/xpi-js');
const bchURL = config.supportToken.xec.bchUrl;
const bchjs = new BCHJS({ restURL: bchURL });
const ecashaddr = require('ecashaddrjs');
const protocolPrefix = { livenet: 'ecash', testnet: 'ectest' };
export interface UtxoToken {
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

export interface TokenInfo {
  coin: string;
  blockCreated?: number;
  circulatingSupply?: number;
  containsBaton: true;
  decimals: number;
  documentHash?: string;
  documentUri: string;
  id: string;
  initialTokenQty: number;
  name: string;
  symbol: string;
  timestamp: string;
  timestamp_unix?: number;
  totalBurned: number;
  totalMinted: number;
  versionType: number;
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
    return await bchjs.SLP.Utils.list(tokenId);
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

    const keyPair = bchjs.HDNode.toKeyPair(change);

    try {
      const utxos = await this.getUtxosToken(wallet);
      if (utxos.length === 0) throw new Error('No UTXOs to spend! Exiting.');

      const bchUtxos = _.filter(utxos, item => item.isNonSLP);

      if (bchUtxos.length === 0) {
        throw new Error('Wallet does not have a BCH UTXO to pay miner fees.');
      }
      const tokenUtxos = await this.getTokenUtxos(utxos, tokenInfo);

      if (tokenUtxos.length === 0) {
        throw new Error('No token UTXOs for the specified token could be found.');
      }

      // Choose a UTXO to pay for the transaction.
      const bchUtxo = this.findBiggestUtxo(bchUtxos);

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
      TOKENQTY = _.toSafeInteger(TOKENQTY);
      TOKENQTY = TOKENQTY / Math.pow(10, tokenInfo.decimals);
      // Generate the OP_RETURN code.
      const slpSendObj = bchjs.SLP.TokenType1.generateSendOpReturn(tokenUtxos, TOKENQTY);
      const slpData = slpSendObj.script;
      // Add OP_RETURN as first output.
      transactionBuilder.addOutput(slpData, 0);

      // Send the token back to the same wallet if the user hasn't specified a
      // different address.

      // Send dust transaction representing tokens being sent.
      const { prefix, type, hash } = ecashaddr.decode(etokenAddress);
      const cashAdr = ecashaddr.encode('bitcoincash', type, hash);
      // const cashAdress = ecashaddr.encodeAddress('bitcoincash', type, hash, etokenAddress);
      transactionBuilder.addOutput(bchjs.SLP.Address.toLegacyAddress(cashAdr), 546);

      // Return any token change back to the sender.
      if (slpSendObj.outputs > 1) {
        transactionBuilder.addOutput(bchjs.SLP.Address.toLegacyAddress(slpAddress), 546);
      }

      // Last output: send the BCH change back to the wallet.
      transactionBuilder.addOutput(bchjs.Address.toLegacyAddress(cashAddress), remainder);

      // Sign the transaction with the private key for the BCH UTXO paying the fees.
      let redeemScript;
      transactionBuilder.sign(0, keyPair, redeemScript, transactionBuilder.hashTypes.SIGHASH_ALL, originalAmount);

      // Sign each token UTXO being consumed.
      for (let i = 0; i < tokenUtxos.length; i++) {
        const thisUtxo = tokenUtxos[i];

        transactionBuilder.sign(1 + i, keyPair, redeemScript, transactionBuilder.hashTypes.SIGHASH_ALL, thisUtxo.value);
      }

      // build tx
      const tx = transactionBuilder.build();

      // output rawhex
      const hex = tx.toHex();
      const txid = await this.broadcast_raw(wallet, hex, true).catch(e => {
        throw e;
      });
      return txid;
    } catch (e) {
      throw e;
    }
    // Get a UTXO
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

  public broadcast_raw(wallet, raw, ischronik) {
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
}
