import { IValidation } from '..';
const BitcoreLtc = require('bitcore-lib-ltc');

export class LtcValidation implements IValidation {
  validateAddress(network: string, address: string): boolean {
    const Address = BitcoreLtc.Address;
    return Address.isValid(address, network);
  }

  validateUri(addressUri: string): boolean {
    // Check if the input is a valid uri or address
    const URICash = BitcoreLtc.URI;
    // Bip21 uri
    return URICash.isValid(addressUri);
  }
}
