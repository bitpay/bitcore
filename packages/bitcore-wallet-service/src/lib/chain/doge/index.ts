import { BitcoreLibDoge } from 'crypto-wallet-core';
import _ from 'lodash';
import { IChain } from '..';
import { BtcChain } from '../btc';

export class DogeChain extends BtcChain implements IChain {
  constructor() {
    super(BitcoreLibDoge);
  }
}
