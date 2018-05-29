import { expect } from 'chai';
import * as sinon from 'sinon';
import { WalletAddressModel } from '../../../src/models/walletAddress';
import { WalletModel } from '../../../src/models/wallet';

describe('WalletAddress Model', function(){
  it('should have a test which runs', function(){
      expect(true).to.equal(true);
  });

  describe('_apiTransform', () => {
    it('should return transform object with wallet addresses', () => {
      let walletAddress = {
        address: '2NA2xTdQH6CG73Gc26oQZ7FEmvTx9Kwo7uf'
      };

      const result = WalletAddressModel._apiTransform(new WalletAddressModel(walletAddress), {
        object: false
      });

      const parseResult = JSON.parse(result);

      expect(parseResult.address).to.be.equal(walletAddress.address);
    });
  });

  describe('updateCoins', () => {
    let updateCoinParams =
    it('should be able to update coins in the wallet', async () => {
      let sandbox;
      beforeEach(() => {
        sandbox = sinon.sandbox.create();
      });
      afterEach(() => {
        sandbox.restore();
      });


      // stub the promises which include map and bulkwrite




    });

  });

});
