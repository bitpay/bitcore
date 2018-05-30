import { expect } from 'chai';
import { WalletAddressModel } from '../../../src/models/walletAddress';
import { IWalletModel } from '../../../src/models/wallet';

describe('WalletAddress Model', function () {
  it('should have a test which runs', function () {
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

  describe('getUpdateCoinsObj', () => {
    it('should return the update coin object', async () => {
      let wallet = {
        name: 'Wallet1',
        singleAddress: true,
        pubKey: 'xpub661MyMwAqRbcFa63vSTa3vmRiVWbpLWhgUsyvjfMFP7ePR5osC1rtPUkgJrB94V1YEQathfWLm9U5zaZttYPDPWhASwJGUvYvPGtofqnTGN',
        path: 'm/44\'/0\'/0\'',
        chain: 'BTC',
        network: 'regtest'
      } as IWalletModel;

      let params = {
        wallet: wallet,
        addresses: ['1', '2']
      }

      const result = WalletAddressModel.getUpdateCoinsObj(params);

      expect(result.walletUpdates).to.have.length(2);
      expect(result.coinUpdates).to.have.length(2);
      expect(result.walletUpdates[0]).to.have.deep.property('updateOne');
      expect(result.walletUpdates[0]).to.have.deep.property('updateOne').to.have.property('filter');
      expect(result.walletUpdates[0]).to.have.deep.property('updateOne').to.have.property('update');
      expect(result.walletUpdates[0]).to.have.deep.property('updateOne').to.have.property('upsert');
      expect(result.walletUpdates[0]).to.deep.equal({
        updateOne: {
          filter: {
            wallet: undefined,
            address: '1'
          },
          update: {
            wallet: undefined,
            address: '1',
            chain: 'BTC',
            network: 'regtest'
          },
          upsert: true
        }
      });
      expect(result.walletUpdates[1]).to.have.deep.property('updateOne');
      expect(result.walletUpdates[1]).to.have.deep.property('updateOne').to.have.property('filter');
      expect(result.walletUpdates[1]).to.have.deep.property('updateOne').to.have.property('update');
      expect(result.walletUpdates[1]).to.have.deep.property('updateOne').to.have.property('upsert');
      expect(result.walletUpdates[1]).to.deep.equal({
        updateOne: {
          filter: {
            wallet: undefined,
            address: '2'
          },
          update: {
            wallet: undefined,
            address: '2',
            chain: 'BTC',
            network: 'regtest'
          },
          upsert: true
        }
      });
      expect(result.coinUpdates[0]).to.have.deep.property('updateMany');
      expect(result.coinUpdates[0]).to.have.deep.property('updateMany').to.have.property('filter');
      expect(result.coinUpdates[0]).to.have.deep.property('updateMany').to.have.property('update');
      expect(result.coinUpdates[0]).to.have.deep.property('updateMany')
        .to.have.property('update')
        .to.have.ownProperty('$addToSet');
      expect(result.coinUpdates[0]).to.deep.equal({
        updateMany: {
          filter: {
            chain: 'BTC',
            network: 'regtest',
            address: '1'
          },
          update: {
            $addToSet: {
              wallets: undefined,
            }
          }
        }
      });
      expect(result.coinUpdates[1]).to.have.deep.property('updateMany');
      expect(result.coinUpdates[1]).to.have.deep.property('updateMany').to.have.property('filter');
      expect(result.coinUpdates[1]).to.have.deep.property('updateMany').to.have.property('update');
      expect(result.coinUpdates[1]).to.have.deep.property('updateMany')
        .to.have.property('update')
        .to.have.ownProperty('$addToSet');
      expect(result.coinUpdates[1]).to.deep.equal({
        updateMany: {
          filter: {
            chain: 'BTC',
            network: 'regtest',
            address: '2'
          },
          update: {
            $addToSet: {
              wallets: undefined,
            }
          }
        }
      });

    });

  });

});
