import { BitcoreLibLtc } from '@bitpay-labs/crypto-wallet-core';
import { IChain } from '../../../types/chain';
import { BtcChain } from '../../chain/btc';

export class LtcChain extends BtcChain implements IChain {
  constructor() {
    super(BitcoreLibLtc);
  }
}
