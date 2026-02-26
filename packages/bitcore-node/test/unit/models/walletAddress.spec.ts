import { expect } from 'chai';
import { IWalletAddress, WalletAddressStorage } from '../../../src/models/walletAddress';
import { unitAfterHelper, unitBeforeHelper } from '../../helpers/unit';

describe('WalletAddress Model', function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  describe('_apiTransform', () => {
    it('should return transform object with wallet addresses', () => {
      let walletAddress: IWalletAddress = {
        address: '2NA2xTdQH6CG73Gc26oQZ7FEmvTx9Kwo7uf'
      } as IWalletAddress;

      const result = WalletAddressStorage._apiTransform(walletAddress, {
        object: false
      }).toString();

      const parseResult = JSON.parse(result);

      expect(parseResult).to.deep.equal({ address: '2NA2xTdQH6CG73Gc26oQZ7FEmvTx9Kwo7uf' });
    });
    it('should return the raw transform object if options field exists and set to true', () => {
      let walletAddress: IWalletAddress = {
        address: '2NA2xTdQH6CG73Gc26oQZ7FEmvTx9Kwo7uf'
      } as IWalletAddress;

      const result = WalletAddressStorage._apiTransform(walletAddress, {
        object: true
      });
      expect(result).to.deep.equal({ address: '2NA2xTdQH6CG73Gc26oQZ7FEmvTx9Kwo7uf' });
    });
  });
});
