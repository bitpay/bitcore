const BitcoreLibCash = require('bitcore-lib-cash');
import { AbstractBitcoreLibDeriver } from '../btc';
export class BchDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = BitcoreLibCash;
}
