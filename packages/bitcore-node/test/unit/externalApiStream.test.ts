import { expect } from 'chai';
import * as sinon from 'sinon';
import axios from 'axios';
import logger from '../../src/logger';
import { ExternalApiStream } from '../../src/providers/chain-state/external/streams/apiStream';

function consume(stream: ExternalApiStream): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    stream.on('data', d => results.push(d));
    stream.on('end', () => resolve(results));
    stream.on('error', reject);
  });
}

describe('ExternalApiStream', function() {
  const sandbox = sinon.createSandbox();
  let axiosGetStub: sinon.SinonStub;

  beforeEach(() => {
    axiosGetStub = sandbox.stub(axios, 'get');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('request timeout', () => {
    it('sends a default timeout with each page request', async () => {
      axiosGetStub.resolves({ data: { result: [{ id: 1 }], cursor: null } });

      const stream = new ExternalApiStream('http://example.test/txs?', {}, {});
      await consume(stream);

      expect(axiosGetStub.callCount).to.equal(1);
      const config = axiosGetStub.firstCall.args[1];
      expect(config.timeout).to.be.a('number');
      expect(config.timeout).to.be.greaterThan(0);
    });

    it('honors an explicit timeout given in args', async () => {
      axiosGetStub.resolves({ data: { result: [{ id: 1 }], cursor: null } });

      const stream = new ExternalApiStream('http://example.test/txs?', {}, { timeout: 5000 });
      await consume(stream);

      const config = axiosGetStub.firstCall.args[1];
      expect(config.timeout).to.equal(5000);
    });

    it('emits an error when the request times out', async () => {
      const timeoutErr = Object.assign(new Error('timeout of 5000ms exceeded'), { code: 'ECONNABORTED', isAxiosError: true });
      axiosGetStub.rejects(timeoutErr);

      const stream = new ExternalApiStream('http://example.test/txs?', {}, { timeout: 5000 });
      let caught: any;
      try {
        await consume(stream);
      } catch (err) {
        caught = err;
      }
      expect(caught).to.exist;
      expect(caught.code).to.equal('ECONNABORTED');
    });
  });

  describe('paging cap', () => {
    it('stops requesting once the page cap is reached', async () => {
      // Provider always returns another cursor, so only the cap ends the stream
      axiosGetStub.callsFake(() => Promise.resolve({ data: { result: [{ id: 1 }], cursor: 'next' } }));

      const stream = new ExternalApiStream('http://example.test/txs?', {}, { paging: 2 });
      const results = await consume(stream);

      expect(axiosGetStub.callCount).to.equal(2);
      expect(results.length).to.equal(2);
    });

    it('applies a default page cap when neither limit nor paging is given', async () => {
      // Provider always returns another cursor; without a cap this would paginate forever
      axiosGetStub.callsFake(() => Promise.resolve({ data: { result: [{ id: 1 }], cursor: 'next' } }));

      const stream = new ExternalApiStream('http://example.test/txs?', {}, {});
      const results = await consume(stream);

      expect(axiosGetStub.callCount).to.equal(ExternalApiStream.DEFAULT_MAX_PAGES);
      expect(results.length).to.equal(ExternalApiStream.DEFAULT_MAX_PAGES);
    });

    it('does not apply the default page cap when an explicit limit is given', async () => {
      axiosGetStub.callsFake(() => Promise.resolve({ data: { result: [{ id: 1 }], cursor: 'next' } }));

      const stream = new ExternalApiStream('http://example.test/txs?', {}, { limit: 3 });
      const results = await consume(stream);

      expect(results.length).to.equal(3);
    });

    it('logs a warning when the default page cap truncates results', async () => {
      const warnSpy = sandbox.spy(logger, 'warn');
      axiosGetStub.callsFake(() => Promise.resolve({ data: { result: [{ id: 1 }], cursor: 'next' } }));

      const defaultCapped = new ExternalApiStream('http://example.test/txs?', {}, {});
      await consume(defaultCapped);
      expect(warnSpy.called).to.equal(true);

      warnSpy.resetHistory();
      // An explicit paging bound is a caller choice, not a safety-net truncation — no warning
      const explicitlyCapped = new ExternalApiStream('http://example.test/txs?', {}, { paging: 2 });
      await consume(explicitlyCapped);
      expect(warnSpy.called).to.equal(false);
    });
  });
});
