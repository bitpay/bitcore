'use strict';

import * as chai from 'chai';
import { registerServiceRoutes } from '../../../src/lib/routes/services';

const should = chai.should();

/**
 * The public/authenticated split for the Rango routes is a security boundary:
 * the five operational routes carry wallet addresses, amounts, transaction
 * hashes and approval state, and they spend the API key. The service tests
 * exercise the service directly and so cannot see which middleware a route was
 * registered with - a single-word edit could quietly make any of them public.
 *
 * These assert the registration itself, by recording whether a handler reaches
 * the server through getServer (public) or getServerWithAuth (authenticated).
 */
describe('Rango route registration', () => {
  const PUBLIC_ROUTES = ['supportedChains', 'cryptoCurrencies'];
  const AUTH_ROUTES = [
    'getSwapQuote',
    'createSwapTx',
    'getStatus',
    'isApproved',
    'reportFailure'
  ];

  let routes: { [path: string]: Function };
  let reachedVia: string;

  const stubServer = {
    externalServices: {
      rango: new Proxy({}, { get: () => () => Promise.resolve({ ok: true }) })
    }
  };

  const invoke = async (path: string) => {
    reachedVia = undefined;
    const res = { json: () => undefined, set: () => undefined };
    await routes[path]({ headers: {}, body: {} }, res);
    return reachedVia;
  };

  beforeEach(() => {
    routes = {};

    const router: any = {
      post: (path, handler) => { routes[path] = handler; },
      get: (path, handler) => { routes[path] = handler; },
      use: () => undefined,
      options: () => undefined
    };

    const context: any = {
      getServer: () => { reachedVia = 'public'; return stubServer; },
      getServerWithAuth: (_req, _res, cb) => { reachedVia = 'auth'; return cb(stubServer); },
      setPublicCache: (res, seconds) => { res.__cacheSeconds = seconds; },
      returnError: err => { throw err; }
    };

    registerServiceRoutes(router, context);
  });

  it('should register all seven Rango routes', () => {
    for (const name of [...PUBLIC_ROUTES, ...AUTH_ROUTES]) {
      should.exist(routes[`/v1/service/rango/${name}`], `${name} is not registered`);
    }
  });

  for (const name of ['supportedChains', 'cryptoCurrencies']) {
    it(`should leave ${name} public`, async () => {
      const via = await invoke(`/v1/service/rango/${name}`);
      via.should.equal('public');
    });
  }

  for (const name of ['getSwapQuote', 'createSwapTx', 'getStatus', 'isApproved', 'reportFailure']) {
    it(`should require authentication for ${name}`, async () => {
      const via = await invoke(`/v1/service/rango/${name}`);
      // Anything but 'auth' here means wallet data or our API key quota is
      // reachable without credentials.
      via.should.equal('auth');
    });
  }
});
