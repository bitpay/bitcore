import { IValidation } from '..';
const BitcoreCash = require('bitcore-lib-cash');

export class BchValidation implements IValidation {
  validateAddress(network: string, address: string): boolean {
      // Check if the input is a valid uri or address
      const URICash = BitcoreCash.URI;
      const AddressCash = BitcoreCash.Address;

      // Bip21 uri
      let uri, uriAddress;
      if (/^bitcoincash:|^bchtest:i/.test(address)) {
        if (URICash.isValid(address)) {
          uri = new URICash(address);
          uriAddress = uri.address.toString();
          if (AddressCash.isValid(uriAddress, network)) return true;
        }
      }

      // Regular Address: try Bitcoin Cash
      if (AddressCash.isValid(address, network)) return true;

      return false;
    }
}
