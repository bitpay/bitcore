import { IValidation } from '..';
import { EthValidation } from '../eth/';
const utils = require('web3-utils');

export class RskValidation extends EthValidation {

  // Overridden validateUri for RSK
  validateUri(addressUri: string): boolean {
    if (!addressUri) {
      return false;
    }
    const address = this.extractAddress(addressUri);
    const rskPrefix = /rsk/i.exec(addressUri);
    return !!rskPrefix && utils.isAddress(address);
  }
}
