import { IValidation } from '..';
const BitcoreCash = require('bitcore-lib-cash');

export class BchValidation implements IValidation {
  validateAddress(network: string, address: string): boolean {
    const AddressCash = BitcoreCash.Address;
    // Regular Address: try Bitcoin Cash
    return AddressCash.isValid(address, network);
  }

  validateUri(addressUri: string): boolean {
    // Check if the input is a valid uri or address
    const URICash = BitcoreCash.URI;
    // Bip21 uri
    return URICash.isValid(addressUri);
  }
}
