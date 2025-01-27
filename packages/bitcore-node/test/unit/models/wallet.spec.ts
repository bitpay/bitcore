import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'assert';
import { ObjectID } from 'bson';
import * as sinon from 'sinon';
import { MongoBound } from '../../../src/models/base';
import { IWallet, WalletStorage } from '../../../src/models/wallet';
import { WalletAddressStorage } from '../../../src/models/walletAddress';
import { mockCollection } from '../../helpers/index.js';
import { unitAfterHelper, unitBeforeHelper } from '../../helpers/unit';

describe('Wallet Model', function() {
  const sandbox = sinon.createSandbox();

  before(unitBeforeHelper);
  after(unitAfterHelper);

  afterEach(function() {
    sandbox.restore();
  });

  describe('_apiTransform', () => {
    it('should return the transform object with wallet info', () => {
      let wallet = {
        name: 'Wallet1',
        singleAddress: true,
        pubKey: 'xpub661MyMwAqRbcFa63vSTa3vmRiVWbpLWhgUsyvjfMFP7ePR5osC1rtPUkgJrB94V1YEQathfWLm9U5zaZttYPDPWhASwJGUvYvPGtofqnTGN',
        path: "m/44'/0'/0'"
      } as IWallet;
      const result = WalletStorage._apiTransform(wallet, { object: false });
      const parseResult = JSON.parse(result.toString());

      assert.deepEqual(parseResult, {
        name: 'Wallet1',
        pubKey: 'xpub661MyMwAqRbcFa63vSTa3vmRiVWbpLWhgUsyvjfMFP7ePR5osC1rtPUkgJrB94V1YEQathfWLm9U5zaZttYPDPWhASwJGUvYvPGtofqnTGN'
      });
    });

    it('should return the raw transform object if options field exists and set to true', () => {
      let wallet = {
        name: 'Wallet1',
        singleAddress: true,
        pubKey: 'xpub661MyMwAqRbcFa63vSTa3vmRiVWbpLWhgUsyvjfMFP7ePR5osC1rtPUkgJrB94V1YEQathfWLm9U5zaZttYPDPWhASwJGUvYvPGtofqnTGN',
        path: "m/44'/0'/0'"
      } as IWallet;
      const result = WalletStorage._apiTransform(wallet, { object: true });
      assert.deepEqual(result, {
        name: 'Wallet1',
        pubKey: 'xpub661MyMwAqRbcFa63vSTa3vmRiVWbpLWhgUsyvjfMFP7ePR5osC1rtPUkgJrB94V1YEQathfWLm9U5zaZttYPDPWhASwJGUvYvPGtofqnTGN'
      });
    });
  });

  describe('updateCoins', () => {
    it('should call wallet address model update coins', async () => {
      sinon.stub(WalletAddressStorage, 'collection').value(mockCollection([]));
      const walletAddressModelStub = sandbox.stub(WalletAddressStorage, 'updateCoins').returns({
        wallet: sandbox.stub().returnsThis(),
        addresses: sandbox.stub().returnsThis()
      });

      const wallet = {
        _id: new ObjectID(),
        name: 'Wallet1',
        singleAddress: true,
        pubKey: 'xpub661MyMwAqRbcFa63vSTa3vmRiVWbpLWhgUsyvjfMFP7ePR5osC1rtPUkgJrB94V1YEQathfWLm9U5zaZttYPDPWhASwJGUvYvPGtofqnTGN',
        path: "m/44'/0'/0'",
        chain: 'BTC',
        network: 'regtest'
      } as MongoBound<IWallet>;

      await WalletStorage.updateCoins(wallet);
      assert.strictEqual(walletAddressModelStub.calledOnce, true);
    });
  });
});
