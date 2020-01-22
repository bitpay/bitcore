const LitcoreLib = require('litecore-lib');
import { IChain } from '..';
import { BtcChain } from '../btc';

const Errors = require('../../errors/errordefinitions');

export class LtcChain extends BtcChain implements IChain {
  constructor() {
    super(LitcoreLib);
  }

  validateAddress(wallet, inaddr, opts) {
    const A = LitcoreLib.Address;
    let addr: {
      network?: string;
      toString?: (cashAddr: boolean) => string;
    } = {};
    try {
      addr = new A(inaddr);
    } catch (ex) {
      return Errors.INVALID_ADDRESS;
    }
    if (addr.network.toString() != wallet.network) {
      return Errors.INCORRECT_ADDRESS_NETWORK;
    }
    if (!opts.noCashAddr) {
      if (addr.toString(true) != inaddr) return Errors.ONLY_CASHADDR;
    }
    return;
  }
}
