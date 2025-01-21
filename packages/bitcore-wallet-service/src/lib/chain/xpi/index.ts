import { BitcoreLibXpi } from '@bcpros/crypto-wallet-core';
import { ChronikClient } from 'chronik-client';
import _ from 'lodash';
import { IChain } from '..';
import { BtcChain } from '../btc';
const config = require('../../../config');
const Common = require('../../common');
const Utils = Common.Utils;
const Errors = require('../../errors/errordefinitions');
const chronikClient = new ChronikClient(config.supportToken.xpi.chronikClientUrl);

export class XpiChain extends BtcChain implements IChain {
  constructor() {
    super(BitcoreLibXpi);
    this.sizeEstimationMargin = config.bch?.sizeEstimationMargin ?? 0.01;
    this.inputSizeEstimationMargin = config.bch?.inputSizeEstimationMargin ?? 2;
  }
  getSizeSafetyMargin(opts: any): number {
    return 0;
  }

  convertFeePerKb(p, feePerKb) {
    return [p, Utils.strip(feePerKb * 1e6)];
  }

  getInputSizeSafetyMargin(opts: any): number {
    return 0;
  }

  getChronikClient() {
    return chronikClient;
  }

  validateAddress(wallet, inaddr, opts) {
    const A = BitcoreLibXpi.Address;
    let addr: {
      network?: BitcoreLibXpi.Networks.Network;
      toString?: () => string;
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
