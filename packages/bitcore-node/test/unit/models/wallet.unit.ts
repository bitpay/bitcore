import { expect } from 'chai';
import * as sinon from 'sinon';
import { WalletModel, IWalletModel } from '../../../src/models/wallet';
import { BlockModel } from '../../../src/models/block';
import { WalletAddressModel } from '../../../src/models/walletAddress';

describe('Wallet Model', function () {

  describe('_apiTransform', () => {
    it('should return the transform object with wallet info', () => {
      let wallet = {
        name: 'Wallet1',
        singleAddress: true,
        pubKey: 'xpub661MyMwAqRbcFa63vSTa3vmRiVWbpLWhgUsyvjfMFP7ePR5osC1rtPUkgJrB94V1YEQathfWLm9U5zaZttYPDPWhASwJGUvYvPGtofqnTGN',
        path: 'm/44\'/0\'/0\''
      }

      const result = WalletModel._apiTransform(new WalletModel(wallet), {
        object: false
      });
      const parseResult = JSON.parse(result);

      expect(parseResult.name).to.be.equal(wallet.name);
      expect(parseResult.pubKey).to.be.equal(wallet.pubKey);

    });
  });

  describe('updateCoins', () => {
    let sandbox;
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should return wallet address model update coins', async () => {
      sandbox.stub(WalletAddressModel, 'find').returns(['test', 'run']);
      let walletAddressModelSpy = sandbox.stub(WalletAddressModel, 'updateCoins').returns({
        wallet: sandbox.stub().returnsThis(),
        addresses: sandbox.stub().returnsThis()
      });

      let wallet = {
        name: 'Wallet1',
        singleAddress: true,
        pubKey: 'xpub661MyMwAqRbcFa63vSTa3vmRiVWbpLWhgUsyvjfMFP7ePR5osC1rtPUkgJrB94V1YEQathfWLm9U5zaZttYPDPWhASwJGUvYvPGtofqnTGN',
        path: 'm/44\'/0\'/0\'',
        chain: 'BTC',
        network: 'regtest'
      } as IWalletModel;

      await WalletModel.updateCoins(wallet);
      expect(walletAddressModelSpy.calledOnce).to.be.true;

    });
  });
});

