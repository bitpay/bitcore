import express from 'express';
import * as _ from 'lodash';
import { Common } from '../common';
import type * as Types from '../../types/expressapp';
import type { GetAddressesOpts } from '../../types/server';

const Utils = Common.Utils;

interface RouteContext {
  getServerWithAuth: Types.GetServerWithAuthFn;
  logDeprecated: Types.LogDeprecatedFn;
  returnError: Types.ReturnErrorFn;
}

export function registerWalletDataRoutes(router: express.Router, context: RouteContext) {
  const { getServerWithAuth, logDeprecated, returnError } = context;

  router.post('/v1/addresses/', (req, res) => {
    logDeprecated(req);
    getServerWithAuth(req, res, server => {
      server.createAddress(
        {
          ignoreMaxGap: true
        },
        (err, address) => {
          if (err) return returnError(err, res, req);
          res.json(address);
        }
      );
    });
  });

  router.post('/v2/addresses/', (req, res) => {
    logDeprecated(req);
    getServerWithAuth(req, res, server => {
      server.createAddress(
        {
          ignoreMaxGap: true
        },
        (err, address) => {
          if (err) return returnError(err, res, req);
          res.json(address);
        }
      );
    });
  });

  router.post('/v3/addresses/', (req, res) => {
    getServerWithAuth(req, res, server => {
      let opts = req.body;
      opts = opts || {};
      opts.noCashAddr = true;
      server.createAddress(opts, (err, address) => {
        if (err) return returnError(err, res, req);
        res.json(address);
      });
    });
  });

  router.post('/v4/addresses/', (req, res) => {
    getServerWithAuth(req, res, server => {
      server.createAddress(req.body, (err, address) => {
        if (err) return returnError(err, res, req);
        res.json(address);
      });
    });
  });

  router.get('/v1/addresses/', (req, res) => {
    logDeprecated(req);
    req.query.noChange = req.query.noChange ?? '1';
    req.redirectedUrl = req.url;
    req.url = '/v2/addresses?' + Object.entries(req.query).map(([key, value]) => `${key}=${value}`).join('&');
    router.handle(req, res);
  });

  router.get('/v2/addresses/', (req, res) => {
    getServerWithAuth(req, res, server => {
      const opts: GetAddressesOpts = {};
      if (req.query.limit) opts.limit = +req.query.limit;
      if (req.query.skip) opts.skip = +req.query.skip;
      opts.reverse = req.query.reverse == '1';
      if (req.query.addresses) {
        opts.addresses = Array.isArray(req.query.addresses) ? req.query.addresses : req.query.addresses.split(',');
      }
      opts.noChange = Utils.castToBool(req.query.noChange);

      server.getAddresses(opts, (err, addresses) => {
        if (err) return returnError(err, res, req);
        res.json(addresses);
      });
    });
  });

  router.get('/v1/balance/', (req, res) => {
    getServerWithAuth(req, res, server => {
      const opts: { coin?: string; twoStep?: boolean; tokenAddress?: string; multisigContractAddress?: string } = {};
      if (req.query.coin) opts.coin = req.query.coin as string;
      if (req.query.twoStep == '1') opts.twoStep = true;
      if (req.query.tokenAddress) opts.tokenAddress = req.query.tokenAddress as string;
      if (req.query.multisigContractAddress) {
        opts.multisigContractAddress = req.query.multisigContractAddress as string;
      }

      server.getBalance(opts, (err, balance) => {
        if (err) return returnError(err, res, req);
        res.json(balance);
      });
    });
  });

  router.get('/v1/sendmaxinfo/', (req, res) => {
    getServerWithAuth(req, res, server => {
      const query = req.query;
      const opts: {
        feePerKb?: number;
        feeLevel?: number;
        returnInputs?: boolean;
        excludeUnconfirmedUtxos?: boolean;
      } = {};
      if (query.feePerKb) opts.feePerKb = +query.feePerKb;
      if (query.feeLevel) opts.feeLevel = Number(query.feeLevel);
      if (query.excludeUnconfirmedUtxos == '1') opts.excludeUnconfirmedUtxos = true;
      if (query.returnInputs == '1') opts.returnInputs = true;

      server.getSendMaxInfo(opts, (err, info) => {
        if (err) return returnError(err, res, req);
        res.json(info);
      });
    });
  });

  router.get('/v1/utxos/', (req, res) => {
    const opts: { addresses?: string[] } = {};
    const addresses = req.query.addresses;
    if (addresses && _.isString(addresses)) {
      opts.addresses = (req.query.addresses as string).split(',');
    }

    getServerWithAuth(req, res, server => {
      server.getUtxos(opts, (err, utxos) => {
        if (err) return returnError(err, res, req);
        res.json(utxos);
      });
    });
  });

  router.get('/v1/txcoins/', (req, res) => {
    const txId = req.query.txId;
    getServerWithAuth(req, res, server => {
      server.getCoinsForTx({ txId }, (err, coins) => {
        if (err) return returnError(err, res, req);
        res.json(coins);
      });
    });
  });

  router.post('/v1/broadcast_raw/', (req, res) => {
    getServerWithAuth(req, res, server => {
      server.broadcastRawTx(req.body, (err, txid) => {
        if (err) return returnError(err, res, req);
        res.json(txid);
        res.end();
      });
    });
  });
}
