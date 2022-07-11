import { EthValidation } from '../eth';
const utils = require('web3-utils');

export class MaticValidation extends EthValidation {
  validateUri(addressUri: string): boolean {
    if (!addressUri) {
      return false;
    }
    const address = this.extractAddress(addressUri);
    const maticPrefix = /matic/i.exec(addressUri);
    return !!maticPrefix && utils.isAddress(address);
  }

  protected extractAddress(data) {
    const prefix = /^[a-z]+:/i;
    const params = /([\?\&](value|gas|gasPrice|gasLimit)=(\d+([\,\.]\d+)?))+/i;
    return data.replace(prefix, '').replace(params, '');
  }
}
