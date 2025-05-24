import { describe, it, before, after } from 'node:test';
import assert from 'assert';
import { Config } from '../../../src/services/config';
import { unitAfterHelper, unitBeforeHelper } from '../../helpers/unit';

describe('Config', function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  it('should give the chain config', () => {
    const chains = Config.chains();
    for (const chain of chains) {
      const networks = Config.networksFor(chain);
      for (const network of networks) {
        const chainConfig = Config.chainConfig({ chain, network });
        assert.notEqual(chainConfig, null);
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
    Config.updateConfig({ chains: testConfig as any });
    const testnetConfig: any = Config.chainConfig({ chain, network });
    assert.notEqual(testnetConfig.title, null);
    assert.deepEqual(testnetConfig, testConfig[chain][network]);
    Config.updateConfig(originalConfig);
  });
});
