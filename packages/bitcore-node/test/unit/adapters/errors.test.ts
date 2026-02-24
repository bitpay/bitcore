import { expect } from 'chai';
import {
  AdapterError, NotFoundError, InvalidRequestError, AuthError,
  RateLimitError, TimeoutError, UpstreamError, AllProvidersUnavailableError
} from '../../../src/providers/chain-state/external/adapters/errors';

describe('Error Taxonomy', function() {

  describe('AdapterError base class', function() {
    it('should extend Error with providerName and affectsHealth', function() {
      const err = new AdapterError('msg', 'TestProvider', false);
      expect(err).to.be.instanceOf(Error);
      expect(err.name).to.equal('AdapterError');
      expect(err.providerName).to.equal('TestProvider');
      expect(err.affectsHealth).to.equal(false);
      expect(err.message).to.equal('msg');
    });

    it('should default affectsHealth to true', function() {
      expect(new AdapterError('msg', 'P').affectsHealth).to.equal(true);
    });
  });

  describe('subclass properties', function() {
    const cases: Array<{ Class: any; args: any[]; affectsHealth: boolean; msgIncludes: string }> = [
      { Class: NotFoundError, args: ['Moralis', 'tx 0xabc'], affectsHealth: false, msgIncludes: 'not found' },
      { Class: InvalidRequestError, args: ['Alchemy', 'bad address'], affectsHealth: false, msgIncludes: 'invalid request' },
      { Class: AuthError, args: ['Moralis'], affectsHealth: true, msgIncludes: 'authentication failed' },
      { Class: RateLimitError, args: ['Alchemy', 5000], affectsHealth: true, msgIncludes: 'rate limited' },
      { Class: TimeoutError, args: ['Moralis', 30000], affectsHealth: true, msgIncludes: '30000ms' },
      { Class: UpstreamError, args: ['Alchemy', 502, 'bad gateway'], affectsHealth: true, msgIncludes: '502' },
    ];

    cases.forEach(({ Class, args, affectsHealth, msgIncludes }) => {
      it(`${Class.name}: affectsHealth=${affectsHealth}, message includes "${msgIncludes}"`, function() {
        const err = new Class(...args);
        expect(err).to.be.instanceOf(AdapterError);
        expect(err.name).to.equal(Class.name);
        expect(err.affectsHealth).to.equal(affectsHealth);
        expect(err.message).to.include(msgIncludes);
        expect(err.providerName).to.be.a('string');
      });
    });
  });

  describe('RateLimitError.retryAfterMs', function() {
    it('should store retryAfterMs when provided', function() {
      expect(new RateLimitError('P', 5000).retryAfterMs).to.equal(5000);
    });

    it('should be undefined when not provided', function() {
      expect(new RateLimitError('P').retryAfterMs).to.equal(undefined);
    });
  });

  describe('UpstreamError message formatting', function() {
    it('should handle missing status and detail', function() {
      expect(new UpstreamError('P').message).to.equal('P: upstream error');
    });

    it('should include status code', function() {
      expect(new UpstreamError('P', 503).message).to.include('503');
    });
  });

  describe('AllProvidersUnavailableError', function() {
    it('should extend Error but NOT AdapterError', function() {
      const err = new AllProvidersUnavailableError('getTransaction', 'ETH', 'mainnet');
      expect(err).to.be.instanceOf(Error);
      expect(err).to.not.be.instanceOf(AdapterError);
      expect(err.name).to.equal('AllProvidersUnavailableError');
      expect(err.message).to.include('ETH:mainnet');
    });
  });

  describe('catch behavior', function() {
    it('all adapter errors should be catchable as AdapterError', function() {
      const errors = [
        new NotFoundError('P', 'r'), new InvalidRequestError('P', 'r'),
        new AuthError('P'), new RateLimitError('P'),
        new TimeoutError('P', 1000), new UpstreamError('P')
      ];
      for (const err of errors) {
        expect(err, `${err.name} should be instanceof AdapterError`).to.be.instanceOf(AdapterError);
      }
    });
  });
});
