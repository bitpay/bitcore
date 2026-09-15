import 'source-map-support/register.js';
import { expect } from 'chai';
import { describe } from 'mocha';
import Ledger from '../../src/ledger/wallet.js';


describe('Other', function () {
  it('should be able to validate chain', async () => {
    for (const chain of ['BTC', 'BCH', 'DOGE', 'LTC', 'ETH', 'SOL']) {
      expect(Ledger.isValidChain(chain)).to.be.true;
    }
    expect(Ledger.isValidChain('not a chain name')).to.be.false;
    expect(Ledger.isValidChain('btc')).to.be.false;
    expect(Ledger.isValidChain(' BTC')).to.be.false;
  });
});
