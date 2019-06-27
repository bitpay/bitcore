import { IValidation } from '..';
const Bitcore = require('bitcore-lib');

 export class BtcValidation implements IValidation {
  validateAddress(network: string, address: string): boolean {
      // Check if the input is a valid uri or address
      const URI = Bitcore.URI;
      const Address = Bitcore.Address;

       // Bip21 uri
      let uri, uriAddress;
      if (/^bitcoin:/.test(address)) {
        if (URI.isValid(address)) {
          uri = new URI(address);
          uriAddress = uri.address.toString();
          return Address.isValid(uriAddress, network);
        }
      }

       // Regular Address: try Bitcoin
      return Address.isValid(address, network);
    }
}
