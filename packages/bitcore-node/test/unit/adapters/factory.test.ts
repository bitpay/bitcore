import { expect } from 'chai';
import { AdapterFactory } from '../../../src/providers/chain-state/external/adapters/factory';

describe('AdapterFactory', function() {
  it('should throw for unknown provider', function() {
    expect(() => AdapterFactory.createAdapter('unknown', {})).to.throw('Unknown indexed API provider');
  });

  it('should register and create a custom adapter', function() {
    class TestAdapter {
      readonly name = 'Test';
      readonly supportedChains = ['ETH'];
    }
    AdapterFactory.registerAdapter('test', TestAdapter as any);
    const adapter = AdapterFactory.createAdapter('test', {});
    expect(adapter.name).to.eq('Test');
    AdapterFactory.registerAdapter('test', undefined as any);
  });

  it('should list supported providers', function() {
    const providers = AdapterFactory.getSupportedProviders();
    expect(providers).to.include('alchemy');
  });

  it('should be case-insensitive for provider names', function() {
    const adapter = AdapterFactory.createAdapter('Alchemy', { apiKey: 'test', network: 'eth-mainnet' });
    expect(adapter).to.exist;
  });
});
