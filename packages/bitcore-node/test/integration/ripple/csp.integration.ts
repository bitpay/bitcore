import { XRP } from '../../../src/modules/ripple/api/csp';
import { expect } from 'chai';
const chain = 'XRP';
const network = 'mainnet';

describe('Ripple Api', () => {
  it('should be able to get the ledger', async () => {
    const client = await XRP.getClient(network);
    const ledger = await client.getLedger();
    expect(ledger).to.exist;
    expect(ledger.ledgerHash).to.exist;
  });

  it('should be able to get local tip', async () => {
    const tip = await XRP.getLocalTip({ chain, network });
    expect(tip).to.exist;
    expect(tip.hash).to.exist;
  });
});
