import 'source-map-support/register.js';
import { expect } from 'chai';
import { describe } from 'mocha';
import Ledger from '../../src/ledger/wallet.js';
import { CHAINS } from '../../src/types/chains.js';

describe.only('Other', function () {
  const ledger = new Ledger({ transport: 'speculos' });
  
  it('should be able to validate chain', async () => {
    for (const chain of ['BTC', 'BCH', 'DOGE', 'LTC', 'ETH', 'SOL']) {
      expect(Ledger.isValidChain(chain)).to.be.true;
    }
    expect(Ledger.isValidChain('not a chain name')).to.be.false;
    expect(Ledger.isValidChain('btc')).to.be.false;
    expect(Ledger.isValidChain(' BTC')).to.be.false;
  });

  it('should be able to get an address from all the chains in one go', async () => {
    await ledger.connect();
    for (const chain of CHAINS) {
      const address = await ledger.getAddress({ chain });
      expect(address, `address for ${chain}`).to.be.a('string');
      expect(address.length).to.be.greaterThan(33);
    }

    await ledger.disconnect();
  });
});
