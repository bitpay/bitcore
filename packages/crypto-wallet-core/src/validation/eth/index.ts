import { IValidation } from '..';
const utils = require('web3-utils');

export class EthValidation implements IValidation {
  validateAddress(_network: string, address: string): boolean {
    return utils.isAddress(address);
  }

  validateUri(addressUri: string): boolean {
    const address = this.sanitizeEthereumUri(addressUri);
    return utils.isAddress(address);
  }

  private sanitizeEthereumUri(data): string {
    let address = data;
    const ethereum = /ethereum:/;

    if (!ethereum.exec(data)) {
      return data;
    }
    const value = /[\?\&]value=(\d+([\,\.]\d+)?)/i;
    const gas = /[\?\&]gas=(\d+([\,\.]\d+)?)/i;
    const gasPrice = /[\?\&]gasPrice=(\d+([\,\.]\d+)?)/i;
    const gasLimit = /[\?\&]gasLimit=(\d+([\,\.]\d+)?)/i;
    const params = [ethereum, value, gas, gasPrice, gasLimit];
    for (const key of params) {
      address = address.replace(key, '');
    }
    return address;
  }
}
