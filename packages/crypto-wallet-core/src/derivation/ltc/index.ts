import BitcoreLibLtc from '@bitpay-labs/bitcore-lib-ltc';
import { AbstractBitcoreLibDeriver } from '../btc';

export class LtcDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = BitcoreLibLtc;
}
