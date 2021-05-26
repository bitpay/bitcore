import { IValidation } from '..';
const BitcoreWcn = require('bitcore-lib-wcn');

export class WcnValidation implements IValidation {
  validateAddress(network: string, address: string): boolean {
    const Address = BitcoreWcn.Address;
    // Regular Address: try Bitcoin
    return Address.isValid(address, network);
  }

  validateUri(addressUri: string): boolean {
    // Check if the input is a valid uri or address
    const URICash = BitcoreWcn.URI;
    // Bip21 uri
    return URICash.isValid(addressUri);
  }
}
