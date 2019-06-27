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
          if (Address.isValid(uriAddress, network)) return true;
        }
      }

       // Regular Address: try Bitcoin
      if (Address.isValid(address, network)) return true;

       return false;
    }
}
