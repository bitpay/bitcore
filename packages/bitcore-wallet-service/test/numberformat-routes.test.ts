'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import express from 'express';
import sinon from 'sinon';
import { Errors } from '../src/lib/errors/errordefinitions';
import { createRouteHelpers } from '../src/lib/routes/context';
import { ApiErrorHelper } from '../src/lib/routes/helpers/error';
import { registerTransactionRoutes } from '../src/lib/routes/transactions';
import { registerWalletRoutes } from '../src/lib/routes/wallets';

const should = chai.should();

describe('Transaction number format routes', function() {
  const routes = [
    ['get', '/v2/txproposals/', 'getPendingTxs'],
    ['post', '/v3/txproposals/', 'createTx'],
    ['post', '/v2/txproposals/:id/signatures/', 'signTx'],
    ['post', '/v1/txproposals/:id/prepare/', 'prepareTx'],
    ['post', '/v2/txproposals/:id/publish/', 'publishTx'],
    ['get', '/v3/wallets/', 'getStatus'],
    ['get', '/v1/wallets/all/', 'getStatus']
  ];

  function setup() {
    const router = express.Router();
    const error = new ApiErrorHelper();
    const returnError = error.returnError.bind(error);
    const helpers = createRouteHelpers(returnError);
    const server: any = { copayerId: 'copayer', walletId: 'wallet' };
    for (const method of new Set(routes.map(route => route[2]))) {
      server[method] = sinon.stub().callsArgWith(1, null, { outputs: [{ amount: '70000000000000010' }] });
    }
    const context = {
      ...helpers,
      returnError,
      getServerWithAuth: sinon.stub().callsFake((_req, _res, cb) => cb(server)),
      getServerWithMultiAuth: sinon.stub().returns([Promise.resolve(server)]),
      createWalletLimiter: sinon.stub().callsArg(2)
    };
    registerTransactionRoutes(router, context);
    registerWalletRoutes(router, context);
    const response: any = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
      end: sinon.stub().returnsThis()
    };
    return { router, server, response, context };
  }

  for (const [method, path, serverMethod] of routes) {
    for (const format of ['number', 'string', 'hex', undefined]) {
      it(`should accept ${format ?? 'unspecified'} on ${method.toUpperCase()} ${path}`, async function() {
        const { router, server, response } = setup();
        const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]);
        const request: any = { query: { numberFormat: format }, body: {}, params: { id: 'proposal' }, headers: {} };

        await route.route.stack[0].handle(request, response);

        server[serverMethod].callCount.should.equal(1);
        chai.expect(server[serverMethod].firstCall.args[0].numberFormat).to.equal(format);
        response.status.called.should.equal(false);
        response.json.callCount.should.equal(1);
      });
    }

    for (const format of ['invalid', 'bigint', 'raw']) {
      it(`should return 400 without executing ${method.toUpperCase()} ${path} for ${format}`, async function() {
        const { router, server, response, context } = setup();
        const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]);
        const request: any = { query: { numberFormat: format }, body: {}, params: { id: 'proposal' }, headers: {} };

        await route.route.stack[0].handle(request, response);

        response.status.calledOnceWithExactly(400).should.equal(true);
        response.json.callCount.should.equal(1);
        response.json.firstCall.args[0].code.should.equal('INVALID_NUMBER_FORMAT');
        server[serverMethod].called.should.equal(false);
        if (path === '/v1/wallets/all/') context.getServerWithMultiAuth.called.should.equal(false);
      });
    }
  }

  it('should list the supported formats in the validation error', function() {
    Errors.INVALID_NUMBER_FORMAT.message.should.include('number, string, hex');
  });
});
