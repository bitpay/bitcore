import { IValidation } from '..';
const liteCore = require('litecore-lib');

export class LtcValidation implements IValidation {
  validateAddress(network: string, address: string): boolean {
    const Address = liteCore.Address;
    return Address.isValid(address, network);
  }

  validateUri(addressUri: string): boolean {
    const URI = liteCore.URI;
    return URI.isValid(addressUri);
  }
}
