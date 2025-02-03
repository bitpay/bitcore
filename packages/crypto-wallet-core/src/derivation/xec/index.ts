const BitcoreLibXec = require('@bcpros/bitcore-lib-xec');

import { AbstractBitcoreLibDeriver } from '../btc';
export class XecDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = BitcoreLibXec;
}
