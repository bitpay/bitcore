import { expect } from 'chai';
import request from 'request';
import * as sinon from 'sinon';
import { XRP } from '../../../../src/modules/ripple/api/csp';

describe('XRP Chain State Provider', () => {
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    XRP.config = { testnet: { provider: { dataHost: 'http://whatevs.yo' } } };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getBlockBeforeTime', () => {
    let requestStub;
    let validBody = {
      ledger: {
        ledger_hash: 'abc123',
        ledger_index: 12,
        parent_hash: 'abc122',
        close_time: 1624990512
      }
    };

    let invalidBody = {};

    beforeEach(() => {
      requestStub = sandbox.stub(request, 'get');
    });

    it('should return block', async () => {
      requestStub.callsArgWith(1, null, null, validBody);
      const res = await XRP.getBlockBeforeTime({ chain: 'XRP', network: 'testnet' });
      expect(res).to.deep.equal({
        ...validBody.ledger,
        chain: 'XRP',
        network: 'testnet',
        hash: validBody.ledger.ledger_hash,
        height: validBody.ledger.ledger_index,
        previousBlockHash: validBody.ledger.parent_hash,
        timeNormalized: new Date(validBody.ledger.close_time *1000)
      });
    });

    it('should resolve on empty response', async () => {
      requestStub.callsArgWith(1, null, null, null);
      const res = await XRP.getBlockBeforeTime({ chain: 'XRP', network: 'testnet' });
      expect(res).to.be.null;
    });

    it('should throw on invalid time', async () => {
      try {
        await XRP.getBlockBeforeTime({ chain: 'XRP', network: 'testnet', time: 'not-a-time' });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err.message).to.equal('Invalid time value')
      }
    });

    it('should throw on response error', async () => {
      requestStub.callsArgWith(1, 'Unresponsive server', null, validBody);
      try {
        await XRP.getBlockBeforeTime({ chain: 'XRP', network: 'testnet' });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).to.equal('Unresponsive server')
      }
    });

    it('should throw on invalid response', async () => {
      requestStub.callsArgWith(1, null, null, invalidBody);
      try {
        await XRP.getBlockBeforeTime({ chain: 'XRP', network: 'testnet' });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err.message).to.equal('Cannot read property \'ledger_hash\' of undefined')
      }
    });

    it('should throw on mis-configuration', async () => {
      requestStub.callsArgWith(1, null, null, validBody);
      XRP.config = {};
      try {
        await XRP.getBlockBeforeTime({ chain: 'XRP', network: 'testnet' });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err.message).to.equal('Cannot read property \'provider\' of undefined')
      }
    });
  });
});