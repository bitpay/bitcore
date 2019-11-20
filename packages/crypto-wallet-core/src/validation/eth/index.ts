import { IValidation } from '..';
const utils = require('web3-utils');

export class EthValidation implements IValidation {
  validateAddress(_network: string, address: string): boolean {
    return utils.isAddress(address);
  }

  validateUri(addressUri: string): boolean {
    const address = this.extractAddress(addressUri);
    const ethereumPrefix = /ethereum/i.exec(addressUri);
    return !!ethereumPrefix && utils.isAddress(address);
  }

  private extractAddress(data) {
    const address = data.replace(/^[a-z]+:/i, '').replace(/\?.*/, '');
    const params = /([\?\&]+[a-z]+=(\d+([\,\.]\d+)?))+/i;
    return address.replace(params, '');
  }
}
