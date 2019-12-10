import { IValidation } from '..';
const utils = require('web3-utils');

export class EthValidation implements IValidation {
  validateAddress(_network: string, address: string): boolean {
    return utils.isAddress(address);
  }

  validateUri(addressUri: string): boolean {
    const address = this.extractAddress(addressUri);
    const ethereumPrefix = /ethereum/i.exec(addressUri);
    const hasParams = /[\?\&]/i.exec(addressUri);
    const value = /[\?\&]value=(\d+([\,\.]\d+)?)/i.exec(addressUri);
    const gas = /[\?\&]gas=(\d+([\,\.]\d+)?)/i.exec(addressUri);
    const gasPrice = /[\?\&]gasPrice=(\d+([\,\.]\d+)?)/i.exec(addressUri);
    const gasLimit = /[\?\&]gasLimit=(\d+([\,\.]\d+)?)/i.exec(addressUri);
    // !(does not include any of the valid params)
    const validParams = !(!value || !gas || !gasPrice || !gasLimit);
    const validAddress = !!ethereumPrefix && utils.isAddress(address);
    return hasParams ? validParams && validAddress : validAddress;
  }

  private extractAddress(data) {
    const address = data.replace(/^[a-z]+:/i, '').replace(/\?.*/, '');
    const params = /([\?\&]+[a-z]+=(\d+([\,\.]\d+)?))+/i;
    return address.replace(params, '');
  }
}
