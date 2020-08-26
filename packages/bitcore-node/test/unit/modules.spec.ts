import { expect } from 'chai';
import { ChainStateProvider } from '../../src/providers/chain-state';
import { Libs } from '../../src/providers/libs';
import { Config } from '../../src/services/config';
import { P2P } from '../../src/services/p2p';
import { Verification } from '../../src/services/verification';
import { unitAfterHelper, unitBeforeHelper } from '../helpers/unit';

describe('Modules', function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  it('should have a test which runs', function() {
    expect(true).to.equal(true);
  });

  it('should have services registered after loading modules', () => {
    const chains = Config.chains();
    for (const chain of chains) {
      const service = ChainStateProvider.get({ chain });
      expect(service).to.exist;
    }
  });

  it('should have libaries registered', () => {
    const chains = ['BTC', 'BCH'];
    for (const chain of chains) {
      const service = Libs.get(chain);
      expect(service).to.exist;
    }
  });

  it('should have p2p services registered', () => {
    const chains = ['BTC', 'BCH'];
    for (const chain of chains) {
      const service = P2P.get(chain);
      expect(service).to.exist;
    }
  });

  it('should have verification services registered', () => {
    const chains = ['BTC', 'BCH'];
    for (const chain of chains) {
      const service = Verification.get(chain);
      expect(service).to.exist;
    }
  });
});
