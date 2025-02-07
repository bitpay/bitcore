const BitcoreLibXpi = require('@bcpros/bitcore-lib-xpi');

import { AbstractBitcoreLibDeriver } from '../btc';
export class XpiDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = BitcoreLibXpi;
}
