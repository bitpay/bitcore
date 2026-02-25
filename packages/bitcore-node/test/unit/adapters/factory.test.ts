import { expect } from 'chai';
import { AdapterFactory } from '../../../src/providers/chain-state/external/adapters/factory';
import config from '../../../src/config';

describe('AdapterFactory', function() {
  const savedExternalProviders = config.externalProviders;

  before(function() {
    (config as any).externalProviders = { ...savedExternalProviders, alchemy: { apiKey: 'test-key' } };
  });

  after(function() {
    (config as any).externalProviders = savedExternalProviders;
  });

  it('should throw for unknown provider', function() {
    expect(() => AdapterFactory.createAdapter({ name: 'unknown', priority: 1 } as any)).to.throw('Unknown indexed API provider');
  });

  it('should register and create a custom adapter', function() {
    class TestAdapter {
      readonly name = 'Test';
      readonly supportedChains = ['ETH'];
    }
    AdapterFactory.registerAdapter('test', TestAdapter as any);
    const adapter = AdapterFactory.createAdapter({ name: 'test', priority: 1 });
    expect(adapter.name).to.eq('Test');
    AdapterFactory.registerAdapter('test', undefined as any);
  });

  it('should list supported providers', function() {
    const providers = AdapterFactory.getSupportedProviders();
    expect(providers).to.include('alchemy');
  });

  it('should be case-insensitive for provider names', function() {
    const adapter = AdapterFactory.createAdapter({ name: 'Alchemy', priority: 1 });
    expect(adapter).to.exist;
  });
});
