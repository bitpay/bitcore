import express from 'express';
import * as _ from 'lodash';
import { WalletService } from '../server';
import { Stats } from '../stats';
import type * as Types from '../../types/expressapp';

interface RouteContext {
  getServerWithAuth: Types.GetServerWithAuthFn;
  setPublicCache: (res: express.Response, seconds: number) => void;
  returnError: Types.ReturnErrorFn;
}

const ONE_MINUTE = 60;

export function registerMaintenanceRoutes(router: express.Router, context: RouteContext) {
  const { getServerWithAuth, setPublicCache, returnError } = context;

  router.post('/v1/addresses/scan/', (req, res) => {
    getServerWithAuth(req, res, server => {
      req.body = req.body || {};
      req.body.startIdx = server.copayerIsSupportStaff ? Number(req.body.startIdx) : null;
      server.startScan(req.body, (err, started) => {
        if (err) return returnError(err, res, req);
        res.json(started);
        res.end();
      });
    });
  });

  router.get('/v1/stats/', (req, res) => {
    setPublicCache(res, 1 * ONE_MINUTE);
    const opts: {
      network?: string;
      coin?: string;
      from?: string;
      to?: string;
    } = {};

    if (req.query.network) opts.network = req.query.network as string;
    if (req.query.coin) opts.coin = req.query.coin as string;
    if (req.query.from) opts.from = req.query.from as string;
    if (req.query.to) opts.to = req.query.to as string;

    const stats = new Stats(opts);
    stats.run((err, data) => {
      if (err) return returnError(err, res, req);
      res.json(data);
      res.end();
    });
  });

  router.get('/v1/version/', (req, res) => {
    setPublicCache(res, 1 * ONE_MINUTE);
    res.json({
      serviceVersion: WalletService.getServiceVersion()
    });
    res.end();
  });

  router.get('/v1/txnotes/:txid', (req, res) => {
    getServerWithAuth(req, res, server => {
      server.getTxNote(
        {
          txid: req.params['txid']
        },
        (err, note) => {
          if (err) return returnError(err, res, req);
          res.json(note);
        }
      );
    });
  });

  router.put('/v1/txnotes/:txid/', (req, res) => {
    req.body.txid = req.params['txid'];
    getServerWithAuth(req, res, server => {
      server.editTxNote(req.body, (err, note) => {
        if (err) return returnError(err, res, req);
        res.json(note);
      });
    });
  });

  router.get('/v1/txnotes/', (req, res) => {
    getServerWithAuth(req, res, server => {
      const opts: { minTs?: number } = {};
      if (req.query.minTs && _.isNumber(+req.query.minTs)) {
        opts.minTs = +req.query.minTs;
      }
      server.getTxNotes(opts, (err, notes) => {
        if (err) return returnError(err, res, req);
        res.json(notes);
      });
    });
  });

  router.post('/v1/clearcache/', (req, res) => {
    getServerWithAuth(req, res, server => {
      server.clearWalletCache(req.query).then(val => {
        if (val) {
          res.sendStatus(200);
        } else {
          res.sendStatus(500);
        }
      });
    });
  });
}
