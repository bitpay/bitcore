import { expect } from 'chai';
import { Config } from '../../../src/services/config';
import { unitAfterHelper, unitBeforeHelper } from '../../helpers/unit';

describe('Config', function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  it('should have a test which runs', function() {
    expect(true).to.equal(true);
  });

  it('should give the chain config', () => {
    const chains = Config.chains();
    for (const chain of chains) {
      const networks = Config.networksFor(chain);
      for (const network of networks) {
        const chainConfig = Config.chainConfig({ chain, network });
        expect(chainConfig).to.exist;
      }
    }
  });

  it('should be able to update config', () => {
    const originalConfig = Config.get();
    const chain = 'BTC';
    const network = 'testnet';
    const testConfig = {
      [chain]: {
        [network]: {
          title: 'test'
        }
      }
    };
    Config.updateConfig({ chains: testConfig });
    const testnetConfig = Config.chainConfig({ chain, network });
    expect(testnetConfig.title).to.exist;
    expect(testnetConfig).to.deep.eq(testConfig[chain][network]);
    Config.updateConfig(originalConfig);
  });
});
