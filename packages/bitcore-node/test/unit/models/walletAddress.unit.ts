import { expect } from 'chai';
import { IWalletAddress, WalletAddressModel } from "../../../src/models/walletAddress";
import { IWallet } from "../../../src/models/wallet";

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

  describe('getUpdateCoinsObj', () => {
    it('should return the update coin object', async () => {
      let wallet = {
        name: 'Wallet1',
        singleAddress: true,
        pubKey: 'xpub661MyMwAqRbcFa63vSTa3vmRiVWbpLWhgUsyvjfMFP7ePR5osC1rtPUkgJrB94V1YEQathfWLm9U5zaZttYPDPWhASwJGUvYvPGtofqnTGN',
        path: 'm/44\'/0\'/0\'',
        chain: 'BTC',
        network: 'regtest'
      } as IWallet;

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
            // TODO: define wallet once wallet code is implemented
            wallet: undefined,
            address: '1'
          },
          update: {
            // TODO: define wallet once wallet code is implemented
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
            // TODO: define wallet once wallet code is implemented
            wallet: undefined,
            address: '2'
          },
          update: {
            // TODO: define wallet once wallet code is implemented
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
              // TODO: define wallet once wallet code is implemented
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
              // TODO: define wallet once wallet code is implemented
              wallets: undefined,
            }
          }
        }
      });
    });
  });
});
