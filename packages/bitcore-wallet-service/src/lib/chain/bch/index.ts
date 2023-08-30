import { BitcoreLibCash } from 'crypto-wallet-core';
import { IChain } from '..';
import config from '../../../config';
import { Errors } from '../../errors/errordefinitions';
import { BtcChain } from '../btc';

export class BchChain extends BtcChain implements IChain {
  constructor() {
    super(BitcoreLibCash);
    this.sizeEstimationMargin = config.bch?.sizeEstimationMargin ?? 0.01;
    this.inputSizeEstimationMargin = config.bch?.inputSizeEstimationMargin ?? 2;
  }
  getSizeSafetyMargin(opts: any): number {
    return 0;
  }

  getInputSizeSafetyMargin(opts: any): number {
    return 0;
  }

  validateAddress(wallet, inaddr, opts) {
    const A = BitcoreLibCash.Address;
    let addr: {
      network?: string;
      toString?: (cashAddr: boolean) => string;
    } = {};
    try {
      addr = new A(inaddr);
    } catch (ex) {
      throw Errors.INVALID_ADDRESS;
    }
    if (!this._isCorrectNetwork(wallet, addr)) {
      throw Errors.INCORRECT_ADDRESS_NETWORK;
    }
    if (!opts.noCashAddr) {
      if (addr.toString(true) != inaddr) throw Errors.ONLY_CASHADDR;
    }
    return;
  }
}
