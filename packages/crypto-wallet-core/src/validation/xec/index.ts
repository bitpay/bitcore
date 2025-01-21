import { IValidation } from '..';
const BitcoreXec = require('@bcpros/bitcore-lib-xec');

export class XecValidation implements IValidation {
  validateAddress(network: string, address: string): boolean {
    const AddressCash = BitcoreXec.Address;
    // Regular Address: try Bitcoin Cash
    return AddressCash.isValid(address, network);
  }

  validateUri(addressUri: string): boolean {
    // Check if the input is a valid uri or address
    const URICash = BitcoreXec.URI;
    // Bip21 uri
    return URICash.isValid(addressUri);
  }
}
