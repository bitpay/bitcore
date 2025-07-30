import { BitcoreLibLtc } from 'crypto-wallet-core';
import { IChain } from '..';
import { BtcChain } from '../btc';

export class LtcChain extends BtcChain implements IChain {
  constructor() {
    super(BitcoreLibLtc);
  }
}
