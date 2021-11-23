import { IValidation } from '..';
const utils = require('web3-utils');

export class RskValidation implements IValidation {
  validateAddress(_network: string, address: string): boolean {
    return utils.isAddress(address); // TODO: add RSK checksum
  }

  validateUri(addressUri: string): boolean {
    if (!addressUri) {
      return false;
    }
    const address = this.extractAddress(addressUri);
    const rskPrefix = /rsk/i.exec(addressUri);
    return !!rskPrefix && utils.isAddress(address);
  }

  private extractAddress(data) {
    const prefix = /^[a-z]+:/i;
    const params = /([\?\&](value|gas|gasPrice|gasLimit)=(\d+([\,\.]\d+)?))+/i;
    return data.replace(prefix, '').replace(params, '');
  }
}
