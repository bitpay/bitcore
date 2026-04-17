import express from 'express';
import rp from 'request-promise-native';
import { Common } from '../common';
import type * as Types from '../../types/expressapp';
import type { WalletService } from '../server';

const { Defaults } = Common;

interface RouteContext {
  getServer: Types.GetServerFn;
  getServerWithAuth: Types.GetServerWithAuthFn;
  setPublicCache: (res: express.Response, seconds: number) => void;
  returnError: Types.ReturnErrorFn;
}

type RouteHandler = (server: WalletService) => Promise<any> | any;

const ONE_MINUTE = 60;

function callbackResult<T>(fn: (cb: (err?: any, data?: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((err, data) => {
      if (err) return reject(err);
      return resolve(data as T);
    });
  });
}

function getServerOrReturnError(req, res, context: RouteContext): WalletService | null {
  try {
    return context.getServer(req, res);
  } catch (err) {
    context.returnError(err, res, req);
    return null;
  }
}

function respondWithPublicServer(req, res, context: RouteContext, handler: RouteHandler) {
  const server = getServerOrReturnError(req, res, context);
  if (!server) return;

  Promise.resolve()
    .then(() => handler(server))
    .then(response => {
      res.json(response);
    })
    .catch(err => {
      context.returnError(err ?? 'unknown', res, req);
    });
}

function respondWithAuthServer(req, res, context: RouteContext, handler: RouteHandler) {
  context.getServerWithAuth(req, res, server => {
    Promise.resolve()
      .then(() => handler(server))
      .then(response => {
        res.json(response);
      })
      .catch(err => {
        context.returnError(err ?? 'unknown', res, req);
      });
  });
}

export function registerServiceRoutes(router: express.Router, context: RouteContext) {
  const { getServerWithAuth, setPublicCache, returnError } = context;

  router.get('/latest-version', async (req, res) => {
    setPublicCache(res, 10 * ONE_MINUTE);
    try {
      res.setHeader('User-Agent', 'copay');
      const options = {
        uri: 'https://api.github.com/repos/bitpay/wallet/releases/latest',
        headers: {
          'User-Agent': 'Copay'
        },
        json: true
      };

      const server = getServerOrReturnError(req, res, context);
      if (!server) return;

      server.storage.checkAndUseGlobalCache(
        'latest-copay-version',
        Defaults.COPAY_VERSION_CACHE_DURATION,
        async (err, version) => {
          if (err) {
            res.send(err);
          }
          if (version) {
            res.json({ version });
          } else {
            try {
              const htmlString = await rp(options);
              if (htmlString['tag_name']) {
                server.storage.storeGlobalCache('latest-copay-version', htmlString['tag_name'], () => {
                  res.json({ version: htmlString['tag_name'] });
                });
              }
            } catch (fetchErr) {
              res.send(fetchErr);
            }
          }
        }
      );
    } catch (err) {
      res.send(err);
    }
  });

  router.get('/v1/fiatrates/:code/', (req, res) => {
    setPublicCache(res, 5 * ONE_MINUTE);
    respondWithPublicServer(req, res, context, server =>
      callbackResult(resolve => {
        server.getFiatRate(
          {
            code: req.params['code'],
            coin: req.query.coin || 'btc',
            ts: req.query.ts ? +req.query.ts : null
          },
          resolve
        );
      })
    );
  });

  router.get('/v2/fiatrates/:code/', (req, res) => {
    setPublicCache(res, 5 * ONE_MINUTE);
    respondWithPublicServer(req, res, context, server =>
      callbackResult(resolve => {
        server.getHistoricalRates(
          {
            code: req.params['code'],
            ts: req.query.ts ? +req.query.ts : null
          },
          resolve
        );
      })
    );
  });

  router.get('/v3/fiatrates/', (req, res) => {
    setPublicCache(res, 5 * ONE_MINUTE);
    respondWithPublicServer(req, res, context, server =>
      callbackResult(resolve => {
        server.getFiatRates(
          {
            code: req.query.code || null,
            ts: req.query.ts ? +req.query.ts : null
          },
          resolve
        );
      })
    );
  });

  router.get('/v3/fiatrates/:coin/', (req, res) => {
    setPublicCache(res, 5 * ONE_MINUTE);
    respondWithPublicServer(req, res, context, server =>
      callbackResult(resolve => {
        server.getFiatRatesByCoin(
          {
            coin: req.params['coin'],
            code: req.query.code || null,
            ts: req.query.ts ? +req.query.ts : null
          },
          resolve
        );
      })
    );
  });

  router.get('/v4/fiatrates/:code/', (req, res) => {
    setPublicCache(res, 5 * ONE_MINUTE);
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.coinGecko.coinGeckoGetFiatRates(req);
    });
  });

  router.get('/v1/services', (req, res) => {
    respondWithPublicServer(req, res, context, server =>
      callbackResult(resolve => {
        server.getServicesData(req.query, resolve);
      })
    );
  });

  router.post('/v1/service/checkAvailability', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.checkServiceAvailability(req);
    });
  });

  router.post('/v1/service/banxa/getCoins', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.banxa.banxaGetCoins(req);
    });
  });

  router.post('/v1/service/banxa/paymentMethods', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.banxa.banxaGetPaymentMethods(req);
    });
  });

  router.post('/v1/service/banxa/quote', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.banxa.banxaGetQuote(req);
    });
  });

  router.post('/v1/service/banxa/createOrder', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.banxa.banxaCreateOrder(req);
    });
  });

  router.post('/v1/service/banxa/getOrder', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.banxa.banxaGetOrder(req);
    });
  });

  router.post('/v1/service/moonpay/getCurrencies', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.moonpay.moonpayGetCurrencies(req);
    });
  });

  router.post('/v1/service/moonpay/quote', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.moonpay.moonpayGetQuote(req);
    });
  });

  router.post('/v1/service/moonpay/sellQuote', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.moonpay.moonpayGetSellQuote(req);
    });
  });

  router.post('/v1/service/moonpay/currencyLimits', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.moonpay.moonpayGetCurrencyLimits(req);
    });
  });

  router.post('/v1/service/moonpay/signedPaymentUrl', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.moonpay.moonpayGetSignedPaymentUrl(req);
    });
  });

  router.post('/v1/service/moonpay/sellSignedPaymentUrl', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.moonpay.moonpayGetSellSignedPaymentUrl(req);
    });
  });

  router.post('/v1/service/moonpay/transactionDetails', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.moonpay.moonpayGetTransactionDetails(req);
    });
  });

  router.post('/v1/service/moonpay/sellTransactionDetails', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.moonpay.moonpayGetSellTransactionDetails(req);
    });
  });

  router.post('/v1/service/moonpay/cancelSellTransaction', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.moonpay.moonpayCancelSellTransaction(req);
    });
  });

  router.post('/v1/service/moonpay/accountDetails', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.moonpay.moonpayGetAccountDetails(req);
    });
  });

  router.post('/v1/service/ramp/quote', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.ramp.rampGetQuote(req);
    });
  });

  router.post('/v1/service/ramp/sellQuote', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.ramp.rampGetSellQuote(req);
    });
  });

  router.post('/v1/service/ramp/signedPaymentUrl', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.ramp.rampGetSignedPaymentUrl(req);
    });
  });

  router.post('/v1/service/ramp/assets', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.ramp.rampGetAssets(req);
    });
  });

  router.post('/v1/service/ramp/sellTransactionDetails', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.ramp.rampGetSellTransactionDetails(req);
    });
  });

  router.post('/v1/service/sardine/quote', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.sardine.sardineGetQuote(req);
    });
  });

  router.post('/v1/service/sardine/getToken', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.sardine.sardineGetToken(req);
    });
  });

  router.post('/v1/service/sardine/getSupportedTokens', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.sardine.sardineGetSupportedTokens(req);
    });
  });

  router.post('/v1/service/sardine/currencyLimits', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.sardine.sardineGetCurrencyLimits(req);
    });
  });

  router.post('/v1/service/sardine/ordersDetails', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.sardine.sardineGetOrdersDetails(req);
    });
  });

  router.post('/v1/service/simplex/getCurrencies', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.simplex.simplexGetCurrencies(req);
    });
  });

  router.post('/v1/service/simplex/quote', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.simplex.simplexGetQuote(req);
    });
  });

  router.post('/v1/service/simplex/sellQuote', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.simplex.simplexGetSellQuote(req);
    });
  });

  router.post('/v1/service/simplex/paymentRequest', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.simplex.simplexPaymentRequest(req);
    });
  });

  router.post('/v1/service/simplex/sellPaymentRequest', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.simplex.simplexSellPaymentRequest(req);
    });
  });

  router.get('/v1/service/simplex/events', (req, res) => {
    getServerWithAuth(req, res, server => {
      Promise.resolve()
        .then(() => server.externalServices.simplex.simplexGetEvents({ env: req.query.env }))
        .then(response => {
          res.json(response);
        })
        .catch(err => {
          returnError(err ?? 'unknown', res, req);
        });
    });
  });

  router.post('/v1/service/thorswap/supportedChains', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.thorswap.thorswapGetSupportedChains(req);
    });
  });

  router.post('/v1/service/thorswap/cryptoCurrencies', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.thorswap.thorswapGetCryptoCurrencies(req);
    });
  });

  router.post('/v1/service/thorswap/getSwapQuote', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.thorswap.thorswapGetSwapQuote(req);
    });
  });

  router.post('/v1/service/thorswap/getSwapTx', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.thorswap.thorswapGetSwapTx(req);
    });
  });

  router.post('/v1/service/transak/getAccessToken', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.transak.transakGetAccessToken(req);
    });
  });

  router.post('/v1/service/transak/cryptoCurrencies', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.transak.transakGetCryptoCurrencies(req);
    });
  });

  router.post('/v1/service/transak/fiatCurrencies', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.transak.transakGetFiatCurrencies(req);
    });
  });

  router.post('/v1/service/transak/quote', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.transak.transakGetQuote(req);
    });
  });

  router.post('/v1/service/transak/signedPaymentUrl', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.transak.transakGetSignedPaymentUrl(req);
    });
  });

  router.post('/v1/service/transak/orderDetails', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.transak.transakGetOrderDetails(req);
    });
  });

  router.post('/v1/service/wyre/walletOrderQuotation', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.wyre.wyreWalletOrderQuotation(req);
    });
  });

  router.post('/v1/service/wyre/walletOrderReservation', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.wyre.wyreWalletOrderReservation(req);
    });
  });

  router.post('/v1/service/changelly/getCurrencies', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.changelly.changellyGetCurrencies(req);
    });
  });

  router.post('/v1/service/changelly/getPairsParams', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.changelly.changellyGetPairsParams(req);
    });
  });

  router.post('/v1/service/changelly/getFixRateForAmount', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.changelly.changellyGetFixRateForAmount(req);
    });
  });

  router.post('/v1/service/changelly/createFixTransaction', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.changelly.changellyCreateFixTransaction(req);
    });
  });

  router.post('/v1/service/changelly/getTransactions', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.changelly.changellyGetTransactions(req);
    });
  });

  router.post('/v1/service/changelly/getStatus', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.changelly.changellyGetStatus(req);
    });
  });

  router.get('/v1/service/oneInch/getReferrerFee', (req, res) => {
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.oneInch.oneInchGetReferrerFee(req);
    });
  });

  router.post('/v1/service/oneInch/getSwap/:chain?', (req, res) => {
    respondWithAuthServer(req, res, context, server => {
      return server.externalServices.oneInch.oneInchGetSwap(req);
    });
  });

  router.get('/v1/service/oneInch/getTokens/:chain?', (req, res) => {
    setPublicCache(res, 1 * ONE_MINUTE);
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.coinGecko.coinGeckoGetTokens(req);
    });
  });

  router.get('/v1/marketstats/:code/', (req, res) => {
    setPublicCache(res, 5 * ONE_MINUTE);
    respondWithPublicServer(req, res, context, server => {
      return server.externalServices.coinGecko.coinGeckoGetMarketStats(req);
    });
  });

  router.get('/v1/services/dex/getSpenderApprovalWhitelist', (req, res) => {
    respondWithPublicServer(req, res, context, server =>
      callbackResult(resolve => {
        server.getSpenderApprovalWhitelist(resolve);
      })
    );
  });
}
