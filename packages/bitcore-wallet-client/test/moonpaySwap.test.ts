'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import sinon from 'sinon';
import Client from '../src';

const should = chai.should();

describe('MoonPay Swap', () => {
  let client;
  let postStub;

  beforeEach(() => {
    client = new Client();
    postStub = sinon.stub(client.request, 'post').resolves({ body: { ok: true } });
  });

  afterEach(() => {
    sinon.restore();
  });

  const routes = [
    ['moonpaySwapGetPaths', 'getPaths'],
    ['moonpaySwapGetQuote', 'getQuote'],
    ['moonpaySwapGetAction', 'getAction'],
    ['moonpaySwapGetStatus', 'getStatus'],
    ['moonpaySwapRegisterTxs', 'registerTxs']
  ];

  for (const [method, route] of routes) {
    it(`#${method} should POST to /v1/service/moonpaySwap/${route}`, async () => {
      const data = { env: 'sandbox', txId: '0xabc' };
      const res = await client[method](data);
      postStub.calledOnce.should.equal(true);
      postStub.firstCall.args[0].should.equal(`/v1/service/moonpaySwap/${route}`);
      postStub.firstCall.args[1].should.deep.equal(data);
      should.exist(res);
      res.body.ok.should.equal(true);
    });
  }

  it('should pass request errors through', async () => {
    postStub.rejects(new Error('boom'));
    let err;
    try {
      await client.moonpaySwapGetQuote({ env: 'sandbox' });
    } catch (e) {
      err = e;
    }
    should.exist(err);
    err.message.should.equal('boom');
  });
});
