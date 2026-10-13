'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import express from 'express';
import sinon from 'sinon';
import { brazeService } from '../src/lib/braze';
import { logger } from '../src/lib/logger';
import { registerWebhookRoutes } from '../src/lib/routes/webhooks';

const should = chai.should();

describe('Webhook routes', function() {
  const sandbox = sinon.createSandbox();

  const routes = [
    ['/v1/service/simplex/webhook', 'simplex', 'simplexHandleWebhook'],
    ['/v1/service/moonpay/webhook', 'moonpay', 'moonpayHandleWebhook'],
    ['/v1/service/ramp/webhook', 'ramp', 'rampHandleWebhook'],
    ['/v1/service/transak/webhook', 'transak', 'transakHandleWebhook'],
    ['/v1/service/banxa/webhook', 'banxa', 'banxaHandleWebhook'],
    ['/v1/service/sardine/webhook', 'sardine', 'sardineHandleWebhook']
  ];

  let trackEvent: sinon.SinonStub;

  beforeEach(function() {
    sandbox.stub(logger, 'info');
    sandbox.stub(logger, 'warn');
    sandbox.stub(logger, 'error');
    trackEvent = sandbox.stub(brazeService, 'trackEvent').resolves();
  });

  afterEach(function() {
    sandbox.restore();
  });

  function buildEvent(partner = 'moonpay') {
    return {
      partner,
      externalId: 'tx1',
      status: 'completed',
      eventName: 'transaction_updated',
      fiatAmount: 100,
      fiatCurrency: 'USD',
      cryptoAmount: 0.002,
      cryptoCurrency: 'BTC',
      paymentMethod: 'credit_debit_card',
      walletAddress: 'bc1qxyz',
      walletAddressTag: 'tag1',
      userId: 'user1',
      env: 'production',
      isEmbedded: false
    };
  }

  function setup() {
    const router = express.Router();
    const server: any = {
      externalServices: {},
      storage: {
        storeOnrampWebhookEvent: sinon.stub().resolves({ inserted: true, isStale: false })
      }
    };
    for (const [, partner, handlerName] of routes) {
      const handler = partner === 'transak'
        ? sinon.stub().resolves({ event: buildEvent(partner) })
        : sinon.stub().returns({ event: buildEvent(partner) });
      server.externalServices[partner] = { [handlerName]: handler };
    }
    const context: any = {
      getServer: sinon.stub().returns(server),
      returnError: sinon.stub()
    };
    registerWebhookRoutes(router, context);
    const response: any = {
      headersSent: false,
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis()
    };
    const request: any = { headers: {}, body: {}, query: {} };
    return { router, server, context, request, response };
  }

  function findRoute(router, path) {
    return router.stack.find(layer => layer.route?.path === path && layer.route.methods.post);
  }

  async function post(router, path, request, response) {
    await findRoute(router, path).route.stack[0].handle(request, response);
  }

  for (const [path, partner, handlerName] of routes) {
    it(`should verify, store and track the event on POST ${path}`, async function() {
      const { router, server, request, response } = setup();
      const handler = server.externalServices[partner][handlerName];

      await post(router, path, request, response);

      handler.calledOnceWithExactly(request).should.equal(true);
      server.storage.storeOnrampWebhookEvent.callCount.should.equal(1);
      server.storage.storeOnrampWebhookEvent.firstCall.args[0].event.partner.should.equal(partner);
      trackEvent.callCount.should.equal(1);
      response.status.calledOnceWithExactly(200).should.equal(true);
      response.json.calledOnceWithExactly({ ok: true }).should.equal(true);
    });
  }

  describe('#handleWebhook', function() {
    const path = '/v1/service/moonpay/webhook';

    it('should send the event to Braze keyed by the user id', async function() {
      const { router, request, response } = setup();

      await post(router, path, request, response);

      const tracked = trackEvent.firstCall.args[0];
      tracked.externalId.should.equal('user1');
      tracked.name.should.equal('BWS - ONRAMP Webhook Received');
      tracked.properties.should.deep.equal({
        partner: 'moonpay',
        status: 'completed',
        eventName: 'transaction_updated',
        externalId: 'tx1',
        fiatAmount: 100,
        fiatCurrency: 'USD',
        cryptoAmount: 0.002,
        cryptoCurrency: 'BTC',
        paymentMethod: 'credit_debit_card',
        walletAddress: 'bc1qxyz',
        walletAddressTag: 'tag1',
        env: 'production',
        isEmbedded: false
      });
    });

    it('should answer 200 without tracking a duplicate delivery', async function() {
      const { router, server, request, response } = setup();
      server.storage.storeOnrampWebhookEvent.resolves({ inserted: false, isStale: false });

      await post(router, path, request, response);

      trackEvent.called.should.equal(false);
      response.status.calledOnceWithExactly(200).should.equal(true);
    });

    it('should answer 200 without tracking a stale (out-of-order) delivery', async function() {
      const { router, server, request, response } = setup();
      server.storage.storeOnrampWebhookEvent.resolves({ inserted: true, isStale: true });

      await post(router, path, request, response);

      trackEvent.called.should.equal(false);
      response.status.calledOnceWithExactly(200).should.equal(true);
    });

    it('should answer 400 and not store the event if verification fails', async function() {
      const { router, server, request, response } = setup();
      server.externalServices.moonpay.moonpayHandleWebhook.throws(new Error('MoonPay webhook signature verification failed'));

      await post(router, path, request, response);

      response.status.calledOnceWithExactly(400).should.equal(true);
      response.json.calledOnceWithExactly({ error: 'MoonPay webhook signature verification failed' }).should.equal(true);
      server.storage.storeOnrampWebhookEvent.called.should.equal(false);
      trackEvent.called.should.equal(false);
    });

    it('should answer 503 if verification could not run (retryable error)', async function() {
      const { router, server, request, response } = setup();
      const err: any = new Error('Transak webhook access token unavailable');
      err.retryable = true;
      server.externalServices.transak.transakHandleWebhook.rejects(err);

      await post(router, '/v1/service/transak/webhook', request, response);

      response.status.calledOnceWithExactly(503).should.equal(true);
      response.json.calledOnceWithExactly({ error: 'Transak webhook access token unavailable' }).should.equal(true);
      server.storage.storeOnrampWebhookEvent.called.should.equal(false);
    });

    it('should answer 400 if the event cannot be keyed for storage', async function() {
      const { router, server, request, response } = setup();
      const err: any = new Error('Missing onramp webhook eventName');
      err.invalidPayload = true;
      server.storage.storeOnrampWebhookEvent.rejects(err);

      await post(router, path, request, response);

      response.status.calledOnceWithExactly(400).should.equal(true);
      trackEvent.called.should.equal(false);
    });

    it('should answer 503 if storage is unavailable so the partner retries', async function() {
      const { router, server, request, response } = setup();
      server.storage.storeOnrampWebhookEvent.rejects(new Error('connection lost'));

      await post(router, path, request, response);

      response.status.calledOnceWithExactly(503).should.equal(true);
      response.json.calledOnceWithExactly({ error: 'Webhook storage temporarily unavailable' }).should.equal(true);
      trackEvent.called.should.equal(false);
    });

    it('should answer 200 even if Braze tracking fails', async function() {
      const { router, request, response } = setup();
      trackEvent.rejects(new Error('Braze down'));

      await post(router, path, request, response);
      await new Promise(resolve => setImmediate(resolve));

      response.status.calledOnceWithExactly(200).should.equal(true);
      (logger.warn as sinon.SinonStub).called.should.equal(true);
    });

    it('should answer 500 on an unexpected error', async function() {
      const { router, request, response } = setup();
      trackEvent.throws(new Error('unexpected'));

      await post(router, path, request, response);

      response.status.calledOnceWithExactly(500).should.equal(true);
      response.json.calledOnceWithExactly({ error: 'Internal error handling webhook' }).should.equal(true);
    });

    it('should not answer twice if the error happens after the response was sent', async function() {
      const { router, request, response } = setup();
      response.json = sinon.stub().callsFake(() => {
        response.headersSent = true;
        throw new Error('socket closed');
      });

      await post(router, path, request, response);

      response.status.calledOnceWithExactly(200).should.equal(true);
      response.json.callCount.should.equal(1);
    });

    it('should do nothing if no server instance is available', async function() {
      const { router, server, context, request, response } = setup();
      context.getServer.returns(undefined);

      await post(router, path, request, response);

      server.externalServices.moonpay.moonpayHandleWebhook.called.should.equal(false);
      response.status.called.should.equal(false);
    });
  });
});
