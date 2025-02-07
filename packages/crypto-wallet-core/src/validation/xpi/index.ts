import { IValidation } from '..';
const BitcoreXpi = require('@bcpros/bitcore-lib-xpi');

export class XpiValidation implements IValidation {
  validateAddress(network: string, address: string): boolean {
    const AddressCash = BitcoreXpi.Address;
    // Regular Address: try Bitcoin Cash
    return AddressCash.isValid(address, network);
  }

  validateUri(addressUri: string): boolean {
    // Check if the input is a valid uri or address
    const URICash = BitcoreXpi.URI;
    // Bip21 uri
    return URICash.isValid(addressUri);
  }
}
