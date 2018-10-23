import { expect } from 'chai';
import { IWalletAddress, WalletAddressModel } from "../../../src/models/walletAddress";

describe('WalletAddress Model', function () {

  describe('_apiTransform', () => {
    it('should return transform object with wallet addresses', () => {
      let walletAddress: IWalletAddress = {
        address: '2NA2xTdQH6CG73Gc26oQZ7FEmvTx9Kwo7uf',
      } as IWalletAddress;

      const result = WalletAddressModel._apiTransform(walletAddress, {
        object: false
      }).toString();

      const parseResult = JSON.parse(result);

      expect(parseResult).to.deep.equal({ address: '2NA2xTdQH6CG73Gc26oQZ7FEmvTx9Kwo7uf' });

    });
    it('should return the raw transform object if options field exists and set to true', () => {

      let walletAddress: IWalletAddress = {
        address: '2NA2xTdQH6CG73Gc26oQZ7FEmvTx9Kwo7uf',
      } as IWalletAddress;

      const result = WalletAddressModel._apiTransform(walletAddress, {
        object: true
      });
      expect(result).to.deep.equal({ address: '2NA2xTdQH6CG73Gc26oQZ7FEmvTx9Kwo7uf' });
    });
  });
});
