import { AbstractBitcoreLibDeriver } from '../btc';
import BitcoreLibDoge from 'bitcore-lib-doge';
export class DogeDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = BitcoreLibDoge;
}
