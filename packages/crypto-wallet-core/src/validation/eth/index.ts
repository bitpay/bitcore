import { IValidation } from '..';
const utils = require('web3-utils');

 export class EthValidation implements IValidation {
  validateAddress(_network: string, address: string): boolean {
    return utils.isAddress(address);
  }
}
