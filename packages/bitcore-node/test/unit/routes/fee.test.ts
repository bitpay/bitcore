import { expect } from 'chai';
import express from 'express';
import { createServer } from 'http';
import sinon from 'sinon';
import supertest from 'supertest';
import config from '../../../src/config';
import { ChainStateProvider } from '../../../src/providers/chain-state';
import { feeRoute } from '../../../src/routes/api/fee';

// Use the real Express query parser and route without starting chain services.
describe('Fee route', function() {
  const app = express();
  app.use('/api/:chain/:network/fee', feeRoute.router);
  const server = createServer(app);
  const request = supertest(server);
  const sandbox = sinon.createSandbox();
  let getFee: sinon.SinonStub;
  let now = Date.now();
  const quote = { feerate: 0.0002, blocks: 2 };

  before(() => new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)));
  after(() => new Promise<void>(resolve => server.close(() => resolve())));

  beforeEach(() => {
    now += 20000;
    sandbox.stub(Date, 'now').callsFake(() => now);
    sandbox.stub(config, 'chains').value({ BTC: { regtest: { defaultFeeMode: 'CONSERVATIVE' } } });
    getFee = sandbox.stub(ChainStateProvider, 'getFee').resolves({ ...quote });
  });

  afterEach(() => sandbox.restore());

  for (const parameter of ['mode', 'txType', 'signatures']) {
    const value = parameter === 'mode' ? 'ECONOMICAL' : '2';
    for (const query of [`${parameter}[]=${value}`, `${parameter}[value]=x`, `${parameter}[toString]=x`]) {
      it(`rejects malformed ${query} before requesting or caching a fee`, async () => {
        await request.get(`/api/BTC/regtest/fee/2?${query}`).timeout(1000).expect(400);
        expect(getFee.called).to.equal(false);
        const response = await request.get('/api/BTC/regtest/fee/2').expect(200);
        expect(response.body).to.deep.equal(quote);
        expect(getFee.calledOnce).to.equal(true);
      });
    }
  }

  it('preserves the configured mode and default signature count', async () => {
    const response = await request.get('/api/BTC/regtest/fee/2').expect(200);
    expect(response.body).to.deep.equal(quote);
    expect(getFee.firstCall.args[0]).to.deep.equal({
      chain: 'BTC', network: 'regtest', target: 2, mode: 'CONSERVATIVE', txType: undefined, signatures: 1
    });
  });

  it('preserves explicit modes, EVM transaction types and signature counts', async () => {
    await request.get('/api/BTC/regtest/fee/2?mode=economical').expect(200);
    expect(getFee.lastCall.args[0].mode).to.equal('ECONOMICAL');
    await request.get('/api/ETH/regtest/fee/2?mode=economical&txType=2&signatures=3').expect(200);
    expect(getFee.lastCall.args[0]).to.deep.equal({
      chain: 'ETH', network: 'regtest', target: 2, mode: undefined, txType: '2', signatures: 3
    });
  });

  it('preserves empty optional values and the signature default', async () => {
    await request.get('/api/BTC/regtest/fee/2?mode=&txType=&signatures=').expect(200);
    expect(getFee.lastCall.args[0]).to.include({ mode: 'CONSERVATIVE', signatures: 1, txType: '' });
  });

  it('rejects unsupported scalar modes and transaction types without calling the provider', async () => {
    await request.get('/api/BTC/regtest/fee/2?mode=invalid').expect(400);
    await request.get('/api/ETH/regtest/fee/2?txType=1').expect(400);
    expect(getFee.called).to.equal(false);
  });
});
