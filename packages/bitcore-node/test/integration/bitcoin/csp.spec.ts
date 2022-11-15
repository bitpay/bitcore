import { expect } from 'chai';
import { CacheStorage } from '../../../src/models/cache';
import { ChainStateProvider } from '../../../src/providers/chain-state';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';
describe('Bitcoin API', function() {
  const suite = this;
  this.timeout(30000);
  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

  it('should be able to get the fees', async () => {
    const chain = 'BTC';
    const network = 'regtest';
    const target = 1;
    const cacheKey = `getFee-${chain}-${network}-${target}`;
    const fee = await ChainStateProvider.getFee({ chain, network, target });
    expect(fee).to.exist;
    const cached = await CacheStorage.getGlobal(cacheKey);
    expect(fee).to.deep.eq(cached);
  });
});
