import { expect } from 'chai';
import { AdapterError, AdapterErrorCode, AllProvidersUnavailableError } from '../../../src/providers/chain-state/external/adapters/errors';

describe('AdapterError', function() {

  it('should extend Error with providerName, code, and affectsHealth', function() {
    const err = new AdapterError('TestProvider', AdapterErrorCode.UPSTREAM, 'something broke');
    expect(err).to.be.instanceOf(Error);
    expect(err.name).to.equal('AdapterError');
    expect(err.providerName).to.equal('TestProvider');
    expect(err.code).to.equal(AdapterErrorCode.UPSTREAM);
    expect(err.affectsHealth).to.equal(true);
    expect(err.message).to.include('something broke');
  });

  it('should use code as message when detail is omitted', function() {
    const err = new AdapterError('P', AdapterErrorCode.RATE_LIMIT);
    expect(err.message).to.equal('P: RATE_LIMIT');
  });

  describe('affectsHealth derived from code', function() {
    const cases: Array<{ code: AdapterErrorCode; affectsHealth: boolean }> = [
      { code: AdapterErrorCode.INVALID_REQUEST, affectsHealth: false },
      { code: AdapterErrorCode.NOT_FOUND, affectsHealth: false },
      { code: AdapterErrorCode.AUTH, affectsHealth: true },
      { code: AdapterErrorCode.RATE_LIMIT, affectsHealth: true },
      { code: AdapterErrorCode.TIMEOUT, affectsHealth: true },
      { code: AdapterErrorCode.UPSTREAM, affectsHealth: true },
    ];

    cases.forEach(({ code, affectsHealth }) => {
      it(`code=${code} → affectsHealth=${affectsHealth}`, function() {
        const err = new AdapterError('P', code);
        expect(err.affectsHealth).to.equal(affectsHealth);
      });
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
});
