import BitcoreLtc from 'bitcore-lib-ltc';
import type { IValidation } from '../../types/validation';

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
