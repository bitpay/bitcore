import { expect } from 'chai';
import * as sinon from 'sinon';
import axios from 'axios';
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

    describe('default cap', () => {
      const realCap = ExternalApiStream.DEFAULT_MAX_PAGES;
      beforeEach(() => {
        ExternalApiStream.DEFAULT_MAX_PAGES = 3;
      });
      afterEach(() => {
        ExternalApiStream.DEFAULT_MAX_PAGES = realCap;
      });

      it('errors instead of ending when the cap is reached with pages left', async () => {
        // Provider always returns another cursor; a normal end here would hand callers a truncated history
        axiosGetStub.callsFake(() => Promise.resolve({ data: { result: [{ id: 1 }], cursor: 'next' } }));

        const stream = new ExternalApiStream('http://example.test/txs?', {}, {});
        const results: any[] = [];
        stream.on('data', d => results.push(d));
        const err: any = await new Promise(resolve => {
          stream.on('error', resolve);
          stream.on('end', () => resolve(null));
        });

        expect(err).to.be.an.instanceof(Error);
        expect(err.message).to.contain('page cap');
        expect(axiosGetStub.callCount).to.equal(3);
        expect(results.length).to.equal(3);
      });

      it('ends normally when the last page lands exactly on the cap', async () => {
        axiosGetStub.onCall(0).resolves({ data: { result: [{ id: 1 }], cursor: 'a' } });
        axiosGetStub.onCall(1).resolves({ data: { result: [{ id: 2 }], cursor: 'b' } });
        axiosGetStub.onCall(2).resolves({ data: { result: [{ id: 3 }], cursor: null } });

        const results = await consume(new ExternalApiStream('http://example.test/txs?', {}, {}));
        expect(results.length).to.equal(3);
      });
    });

    it('does not apply the default page cap when an explicit limit is given', async () => {
      axiosGetStub.callsFake(() => Promise.resolve({ data: { result: [{ id: 1 }], cursor: 'next' } }));

      const stream = new ExternalApiStream('http://example.test/txs?', {}, { limit: 3 });
      const results = await consume(stream);

      expect(results.length).to.equal(3);
    });

    it('ends quietly at an explicit paging bound even with pages left', async () => {
      axiosGetStub.callsFake(() => Promise.resolve({ data: { result: [{ id: 1 }], cursor: 'next' } }));

      const results = await consume(new ExternalApiStream('http://example.test/txs?', {}, { paging: 2 }));
      expect(results.length).to.equal(2);
    });
  });
});
