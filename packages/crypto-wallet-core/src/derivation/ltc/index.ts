import { AbstractBitcoreLibDeriver } from '../btc';
import BitcoreLibLtc from 'bitcore-lib-ltc';
export class LtcDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = BitcoreLibLtc;
}
