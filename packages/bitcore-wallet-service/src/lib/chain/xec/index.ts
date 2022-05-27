import { BitcoreLibXec } from '@abcpros/crypto-wallet-core';
import _ from 'lodash';
import { IChain } from '..';
import { BtcChain } from '../btc';
import { ChronikClient } from 'chronik-client';
const config = require('../../../config');

const Errors = require('../../errors/errordefinitions');
const Common = require('../../common');
const Utils = Common.Utils;
const BCHJS = require('@abcpros/xpi-js');
const bchURL = config.supportToken.xec.bchUrl;
const bchjs = new BCHJS({ restURL: bchURL });
const ecashaddr = require('ecashaddrjs');
const protocolPrefix = { livenet: 'ecash', testnet: 'ectest' };
const chronikClient = new ChronikClient("https://chronik.be.cash/xec");

export class XecChain extends BtcChain implements IChain {
  constructor() {
    super(BitcoreLibXec);
    this.sizeEstimationMargin = config.bch?.sizeEstimationMargin ?? 0.01;
    this.inputSizeEstimationMargin = config.bch?.inputSizeEstimationMargin ?? 2;
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
    return chronikClient;
  }

  async getTokenInfo(tokenId) {
    return await bchjs.SLP.Utils.list(tokenId);
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
