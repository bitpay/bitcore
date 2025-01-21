const BitcoreLibLtc = require('@bcpros/bitcore-lib-ltc');
import { AbstractBitcoreLibDeriver } from '../btc';
export class LtcDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = BitcoreLibLtc;
}
