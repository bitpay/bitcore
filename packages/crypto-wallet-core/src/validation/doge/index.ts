import { IValidation } from '..';
const BitcoreDoge = require('bitcore-lib-doge');

export class DogeValidation implements IValidation {
  validateAddress(network: string, address: string): boolean {
    const Address = BitcoreDoge.Address;
    return Address.isValid(address, network);
  }

  validateUri(addressUri: string): boolean {
    // Check if the input is a valid uri or address
    const URICash = BitcoreDoge.URI;
    // Bip21 uri
    return URICash.isValid(addressUri);
  }
}
