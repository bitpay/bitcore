import { expect } from 'chai';
import { Validation, Transactions, Deriver } from '../src';

describe('Proxy Error Handling', () => {

  describe('ValidationProxy', () => {
    describe('getSupportedChains', () => {
      it('should return an array of supported chain identifiers', () => {
        const chains = Validation.getSupportedChains();
        expect(chains).to.be.an('array');
        expect(chains).to.include('BTC');
        expect(chains).to.include('ETH');
        expect(chains).to.include('XRP');
        expect(chains).to.include('SOL');
        expect(chains).to.include('DOGE');
        expect(chains).to.include('LTC');
        expect(chains).to.include('BCH');
        expect(chains).to.include('MATIC');
        expect(chains).to.include('ARB');
        expect(chains).to.include('BASE');
        expect(chains).to.include('OP');
      });
    });

    describe('isSupported', () => {
      it('should return true for supported chains', () => {
        expect(Validation.isSupported('BTC')).to.be.true;
        expect(Validation.isSupported('eth')).to.be.true;
        expect(Validation.isSupported('Xrp')).to.be.true;
      });

      it('should return false for unsupported chains', () => {
        expect(Validation.isSupported('INVALID')).to.be.false;
        expect(Validation.isSupported('AVAX')).to.be.false;
      });

      it('should return false for invalid inputs', () => {
        expect(Validation.isSupported('')).to.be.false;
        expect(Validation.isSupported(null as any)).to.be.false;
        expect(Validation.isSupported(undefined as any)).to.be.false;
        expect(Validation.isSupported(123 as any)).to.be.false;
      });
    });

    describe('get', () => {
      it('should return a validator for a supported chain', () => {
        const validator = Validation.get('BTC');
        expect(validator).to.have.property('validateAddress');
        expect(validator).to.have.property('validateUri');
      });

      it('should be case-insensitive', () => {
        const validator = Validation.get('btc');
        expect(validator).to.have.property('validateAddress');
      });

      it('should throw for unsupported chains', () => {
        expect(() => Validation.get('INVALID')).to.throw('Unsupported chain: INVALID');
      });

      it('should throw for empty string', () => {
        expect(() => Validation.get('')).to.throw('Chain must be a non-empty string');
      });

      it('should throw for non-string input', () => {
        expect(() => Validation.get(null as any)).to.throw('Chain must be a non-empty string');
        expect(() => Validation.get(undefined as any)).to.throw('Chain must be a non-empty string');
        expect(() => Validation.get(42 as any)).to.throw('Chain must be a non-empty string');
      });
    });

    describe('validateAddress edge cases', () => {
      it('should return false for empty address', () => {
        expect(Validation.validateAddress('BTC', 'mainnet', '')).to.be.false;
      });

      it('should return false for null address', () => {
        expect(Validation.validateAddress('BTC', 'mainnet', null as any)).to.be.false;
      });

      it('should return false for non-string address', () => {
        expect(Validation.validateAddress('BTC', 'mainnet', 123 as any)).to.be.false;
      });

      it('should throw for unsupported chain', () => {
        expect(() => Validation.validateAddress('INVALID', 'mainnet', 'someaddress')).to.throw('Unsupported chain');
      });
    });

    describe('validateUri edge cases', () => {
      it('should return false for empty URI', () => {
        expect(Validation.validateUri('BTC', '')).to.be.false;
      });

      it('should return false for null URI', () => {
        expect(Validation.validateUri('BTC', null as any)).to.be.false;
      });

      it('should return false for non-string URI', () => {
        expect(Validation.validateUri('ETH', 123 as any)).to.be.false;
      });

      it('should throw for unsupported chain', () => {
        expect(() => Validation.validateUri('INVALID', 'bitcoin:someaddress')).to.throw('Unsupported chain');
      });
    });
  });

  describe('TransactionsProxy', () => {
    describe('getSupportedChains', () => {
      it('should return an array of supported chain identifiers', () => {
        const chains = Transactions.getSupportedChains();
        expect(chains).to.be.an('array');
        expect(chains).to.include('BTC');
        expect(chains).to.include('ETH');
        expect(chains).to.include('ETHERC20');
        expect(chains).to.include('SOL');
        expect(chains).to.include('SOLSPL');
      });
    });

    describe('isSupported', () => {
      it('should return true for supported chains', () => {
        expect(Transactions.isSupported('BTC')).to.be.true;
        expect(Transactions.isSupported('eth')).to.be.true;
        expect(Transactions.isSupported('ETHERC20')).to.be.true;
      });

      it('should return false for unsupported chains', () => {
        expect(Transactions.isSupported('INVALID')).to.be.false;
      });

      it('should return false for invalid inputs', () => {
        expect(Transactions.isSupported('')).to.be.false;
        expect(Transactions.isSupported(null as any)).to.be.false;
      });
    });

    describe('get', () => {
      it('should return a provider for a supported chain', () => {
        const provider = Transactions.get({ chain: 'BTC' });
        expect(provider).to.have.property('create');
      });

      it('should throw for unsupported chains', () => {
        expect(() => Transactions.get({ chain: 'INVALID' })).to.throw('Unsupported chain: INVALID');
      });

      it('should throw for missing chain property', () => {
        expect(() => Transactions.get({} as any)).to.throw('Chain must be a non-empty string');
      });

      it('should throw for null params', () => {
        expect(() => Transactions.get(null as any)).to.throw('Params must be an object');
      });

      it('should throw for non-object params', () => {
        expect(() => Transactions.get('BTC' as any)).to.throw('Params must be an object');
      });
    });
  });

  describe('DeriverProxy', () => {
    describe('getSupportedChains', () => {
      it('should return an array of supported chain identifiers', () => {
        const chains = Deriver.getSupportedChains();
        expect(chains).to.be.an('array');
        expect(chains).to.include('BTC');
        expect(chains).to.include('ETH');
        expect(chains).to.include('SOL');
      });
    });

    describe('isSupported', () => {
      it('should return true for supported chains', () => {
        expect(Deriver.isSupported('BTC')).to.be.true;
        expect(Deriver.isSupported('eth')).to.be.true;
      });

      it('should return false for unsupported chains', () => {
        expect(Deriver.isSupported('INVALID')).to.be.false;
      });

      it('should return false for invalid inputs', () => {
        expect(Deriver.isSupported('')).to.be.false;
        expect(Deriver.isSupported(null as any)).to.be.false;
      });
    });

    describe('pathFor', () => {
      it('should return correct path for BTC mainnet', () => {
        const path = Deriver.pathFor('BTC', 'mainnet');
        expect(path).to.equal("m/44'/0'/0'");
      });

      it('should return correct path for ETH', () => {
        const path = Deriver.pathFor('ETH', 'mainnet');
        expect(path).to.equal("m/44'/60'/0'");
      });

      it('should return correct path for SOL', () => {
        const path = Deriver.pathFor('SOL', 'mainnet');
        expect(path).to.equal("m/44'/501'/0'");
      });

      it('should handle custom account index', () => {
        const path = Deriver.pathFor('BTC', 'mainnet', 5);
        expect(path).to.equal("m/44'/0'/5'");
      });

      it('should throw for empty chain', () => {
        expect(() => Deriver.pathFor('', 'mainnet')).to.throw('Chain must be a non-empty string');
      });

      it('should throw for non-string chain', () => {
        expect(() => Deriver.pathFor(null as any, 'mainnet')).to.throw('Chain must be a non-empty string');
      });

      it('should fallback to BTC default for unknown chains', () => {
        const path = Deriver.pathFor('UNKNOWN_CHAIN_XYZ', 'testnet');
        expect(path).to.equal("m/44'/1'/0'");
      });

      it('should be case-insensitive', () => {
        const path = Deriver.pathFor('btc', 'mainnet');
        expect(path).to.equal("m/44'/0'/0'");
      });
    });
  });
});
