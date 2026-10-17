import 'source-map-support/register.js';
import { expect } from 'chai';
import { describe } from 'mocha';
import { HwProxy } from '../src/index.js';
import CWC from '@bitpay-labs/crypto-wallet-core';

describe('HwProxy', function () {
  describe('isValid', function () {
    it('should be able to validate chains for ledger', done => {
      for (const chain of ['BTC', 'BCH', 'DOGE', 'LTC', 'ETH', 'SOL']) {
        expect(HwProxy.isValidChain('ledger', chain)).to.be.true;
      }
      expect(HwProxy.isValidChain('ledger', 'not a chain name')).to.be.false;
      expect(HwProxy.isValidChain('ledger', 'btc')).to.be.false;
      expect(HwProxy.isValidChain('ledger', ' BTC')).to.be.false;
      done();
    });
  
    it('should be able to validate chains for burner', done => {
      for (const chain of ['BTC', 'ETH']) {
        expect(HwProxy.isValidChain('burner', chain)).to.be.true;
      }
      for (const chain of ['BCH', 'DOGE', 'LTC', 'SOL']) {
        expect(HwProxy.isValidChain('burner', chain)).to.be.false;
      }
      expect(HwProxy.isValidChain('burner', 'not a chain name')).to.be.false;
      expect(HwProxy.isValidChain('burner', 'btc')).to.be.false;
      expect(HwProxy.isValidChain('burner', ' BTC')).to.be.false;
      expect(HwProxy.isValidChain('burner', ' BTC')).to.be.false;
      done();
    });
  
    it('should tell typescript that the chain is valid', async () => {
      await HwProxy.connect();
      const addresses: string[] = [];
      for (const chain of ['BTC', 'BCH', 'DOGE', 'not a chain', 'LTC', 'ETH', 'SOL']) {
        if (HwProxy.isValidChain('ledger', chain)) {
          const address = await HwProxy.getAddress({
            wallet: 'ledger',
            transport: 'speculos',
            chain
          });
          addresses.push(address);
        }

        if (HwProxy.isValidChain('burner', chain)) {
          const privateKey = new CWC.BitcoreLib.PrivateKey();
          const publicKey = privateKey.toPublicKey();
          const addressRequest: Promise<string> = HwProxy.getAddress({
            wallet: 'burner',
            transport: 'nfc',
            chain
          });
          if (chain === 'BTC') {
            HwProxy.get('burner').responses.set(
              'get_data_struct_v20',
              {
                compressedPublicKey: {
                  9: {
                    value: publicKey.toString()
                  }
                },
              }
            );
          } else {
            HwProxy.get('burner').responses.set(
              'get_data_struct_v20',
              {
                publicKey: {
                  9: {
                    value: publicKey.toString()
                  }
                },
              }
            );
          }
          addresses.push(await addressRequest);
        }
      }
      expect(addresses.length).to.equal(8);
      await HwProxy.disconnect();
    });
  });
});
