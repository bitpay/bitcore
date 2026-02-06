import BitcoreLibDoge from '@bitpay-labs/bitcore-lib-doge';
import { AbstractBitcoreLibDeriver } from '../btc';

export class DogeDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = BitcoreLibDoge;
}
