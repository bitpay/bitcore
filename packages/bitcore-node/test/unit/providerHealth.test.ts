import { expect } from 'chai';
import sinon from 'sinon';
import { ProviderHealth } from '../../src/providers/chain-state/external/providerHealth';

describe('ProviderHealth', function() {
  let clock: sinon.SinonFakeTimers;

  beforeEach(function() {
    clock = sinon.useFakeTimers();
  });

  afterEach(function() {
    clock.restore();
  });

  it('should start available', function() {
    const ph = new ProviderHealth('test');
    expect(ph.isAvailable()).to.equal(true);
  });

  it('should remain available below failure threshold', function() {
    const ph = new ProviderHealth('test', { failureThreshold: 3 });
    ph.recordFailure(new Error('fail'));
    ph.recordFailure(new Error('fail'));
    expect(ph.isAvailable()).to.equal(true);
  });

  it('should become unavailable at failure threshold', function() {
    const ph = new ProviderHealth('test', { failureThreshold: 3 });
    ph.recordFailure(new Error('fail'));
    ph.recordFailure(new Error('fail'));
    ph.recordFailure(new Error('fail'));
    expect(ph.isAvailable()).to.equal(false);
  });

  it('should become available again after cooldown', function() {
    const ph = new ProviderHealth('test', { failureThreshold: 2, cooldownMs: 1000 });
    ph.recordFailure(new Error('fail'));
    ph.recordFailure(new Error('fail'));
    expect(ph.isAvailable()).to.equal(false);
    clock.tick(1001);
    expect(ph.isAvailable()).to.equal(true);
  });

  it('should go back to unavailable if retry fails', function() {
    const ph = new ProviderHealth('test', { failureThreshold: 2, cooldownMs: 1000 });
    ph.recordFailure(new Error('fail'));
    ph.recordFailure(new Error('fail'));
    clock.tick(1001);
    ph.isAvailable(); // allows retry
    ph.recordFailure(new Error('still failing'));
    expect(ph.isAvailable()).to.equal(false);
  });

  it('should reset on success', function() {
    const ph = new ProviderHealth('test', { failureThreshold: 3 });
    ph.recordFailure(new Error('fail'));
    ph.recordFailure(new Error('fail'));
    ph.recordSuccess();
    ph.recordFailure(new Error('fail'));
    ph.recordFailure(new Error('fail'));
    // Should still be available — success reset the counter
    expect(ph.isAvailable()).to.equal(true);
  });

  it('should use composite key with chain:network:provider', function() {
    const ph = new ProviderHealth('Alchemy', undefined, { chain: 'ETH', network: 'mainnet' });
    expect(ph.key).to.equal('ETH:mainnet:Alchemy');
  });

  it('should report status correctly', function() {
    const ph = new ProviderHealth('test', { failureThreshold: 3 });
    ph.recordFailure(new Error('fail'));
    const status = ph.getStatus();
    expect(status.available).to.equal(true);
    expect(status.consecutiveFailures).to.equal(1);
  });
});
