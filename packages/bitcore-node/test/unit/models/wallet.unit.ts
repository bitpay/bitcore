import { expect } from 'chai';
import * as sinon from 'sinon';
import { WalletModel, IWallet } from '../../../src/models/wallet';
import { WalletAddressModel } from '../../../src/models/walletAddress';
import { mockCollection } from "../../helpers/index.js";

describe('Wallet Model', function () {

  describe('_apiTransform', () => {
    it('should return the transform object with wallet info', () => {
      let wallet = {
        name: 'Wallet1',
        singleAddress: true,
        pubKey: 'xpub661MyMwAqRbcFa63vSTa3vmRiVWbpLWhgUsyvjfMFP7ePR5osC1rtPUkgJrB94V1YEQathfWLm9U5zaZttYPDPWhASwJGUvYvPGtofqnTGN',
        path: 'm/44\'/0\'/0\''
      } as IWallet;
      const result = WalletModel._apiTransform(wallet, { object: false });
      const parseResult = JSON.parse(result.toString());

      expect(parseResult).to.deep.equal({
        name: 'Wallet1',
        pubKey: 'xpub661MyMwAqRbcFa63vSTa3vmRiVWbpLWhgUsyvjfMFP7ePR5osC1rtPUkgJrB94V1YEQathfWLm9U5zaZttYPDPWhASwJGUvYvPGtofqnTGN'
      });

    });
    it('should return the raw transform object if options field exists and set to true', () => {
      let wallet = {
        name: 'Wallet1',
        singleAddress: true,
        pubKey: 'xpub661MyMwAqRbcFa63vSTa3vmRiVWbpLWhgUsyvjfMFP7ePR5osC1rtPUkgJrB94V1YEQathfWLm9U5zaZttYPDPWhASwJGUvYvPGtofqnTGN',
        path: 'm/44\'/0\'/0\''
      } as IWallet;
      const result = WalletModel._apiTransform(wallet, { object: true });
      expect(result).to.deep.equal({
        name: 'Wallet1',
        pubKey: 'xpub661MyMwAqRbcFa63vSTa3vmRiVWbpLWhgUsyvjfMFP7ePR5osC1rtPUkgJrB94V1YEQathfWLm9U5zaZttYPDPWhASwJGUvYvPGtofqnTGN'
      });

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
    it('should call wallet address model update coins', async () => {
      Object.assign(WalletAddressModel.collection, mockCollection([]))
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
      } as IWallet;

      await WalletModel.updateCoins(wallet);
      expect(walletAddressModelSpy.calledOnce).to.be.true;

    });
  });
});

