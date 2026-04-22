import express from 'express';
import { Errors } from '../errors/errordefinitions';
import type * as Types from '../../types/expressapp';

interface RouteContext {
  getServerWithAuth: Types.GetServerWithAuthFn;
  returnError: Types.ReturnErrorFn;
}

export function registerTransactionRoutes(router: express.Router, context: RouteContext) {
  const { getServerWithAuth, returnError } = context;

  router.get('/v1/txproposals/', (req, res) => {
    getServerWithAuth(req, res, server => {
      server.getPendingTxs({ noCashAddr: true }, (err, pendings) => {
        if (err) return returnError(err, res, req);
        res.json(pendings);
      });
    });
  });

  router.get('/v2/txproposals/', (req, res) => {
    getServerWithAuth(req, res, server => {
      server.getPendingTxs({}, (err, pendings) => {
        if (err) return returnError(err, res, req);
        res.json(pendings);
      });
    });
  });

  router.post('/v1/txproposals/', (req, res) => {
    return returnError(Errors.UPGRADE_NEEDED, res, req);
  });

  router.post('/v2/txproposals/', (req, res) => {
    getServerWithAuth(req, res, server => {
      req.body.noCashAddr = true;
      req.body.txpVersion = 3;
      server.createTx(req.body, (err, txp) => {
        if (err) return returnError(err, res, req);
        res.json(txp);
      });
    });
  });

  router.post('/v3/txproposals/', (req, res) => {
    getServerWithAuth(req, res, server => {
      req.body.txpVersion = 3;
      server.createTx(req.body, (err, txp) => {
        if (err) return returnError(err, res, req);
        res.json(txp);
      });
    });
  });

  router.post('/v1/txproposals/:id/signatures/', (req, res) => {
    getServerWithAuth(req, res, server => {
      req.body.maxTxpVersion = 3;
      req.body.txProposalId = req.params['id'];
      server.signTx(req.body, (err, txp) => {
        if (err) return returnError(err, res, req);
        res.json(txp);
        res.end();
      });
    });
  });

  router.post('/v2/txproposals/:id/signatures/', (req, res) => {
    getServerWithAuth(req, res, server => {
      req.body.txProposalId = req.params['id'];
      req.body.maxTxpVersion = 3;
      req.body.supportBchSchnorr = true;
      server.signTx(req.body, (err, txp) => {
        if (err) return returnError(err, res, req);
        res.json(txp);
        res.end();
      });
    });
  });

  router.post('/v1/txproposals/:id/prepare/', (req, res) => {
    getServerWithAuth(req, res, server => {
      req.body.txProposalId = req.params['id'];
      server.prepareTx(req.body, (err, txp) => {
        if (err) return returnError(err, res, req);
        res.json(txp);
        res.end();
      });
    });
  });

  router.post('/v1/txproposals/:id/publish/', (req, res) => {
    getServerWithAuth(req, res, server => {
      req.body.txProposalId = req.params['id'];
      req.body.noCashAddr = true;
      server.publishTx(req.body, (err, txp) => {
        if (err) return returnError(err, res, req);
        res.json(txp);
        res.end();
      });
    });
  });

  router.post('/v2/txproposals/:id/publish/', (req, res) => {
    getServerWithAuth(req, res, server => {
      req.body.txProposalId = req.params['id'];
      server.publishTx(req.body, (err, txp) => {
        if (err) return returnError(err, res, req);
        res.json(txp);
        res.end();
      });
    });
  });

  router.post('/v1/txproposals/:id/broadcast/', (req, res) => {
    getServerWithAuth(req, res, server => {
      req.body.txProposalId = req.params['id'];
      server.broadcastTx(req.body, (err, txp) => {
        if (err) return returnError(err, res, req);
        res.json(txp);
        res.end();
      });
    });
  });

  router.post('/v1/txproposals/:id/rejections', (req, res) => {
    getServerWithAuth(req, res, server => {
      req.body.txProposalId = req.params['id'];
      server.rejectTx(req.body, (err, txp) => {
        if (err) return returnError(err, res, req);
        res.json(txp);
        res.end();
      });
    });
  });

  router.delete('/v1/txproposals/:id/', (req, res) => {
    getServerWithAuth(req, res, server => {
      req.body.txProposalId = req.params['id'];
      server.removePendingTx(req.body, err => {
        if (err) return returnError(err, res, req);
        res.json({ success: true });
        res.end();
      });
    });
  });

  router.get('/v1/txproposals/:id/', (req, res) => {
    getServerWithAuth(req, res, server => {
      req.body.txProposalId = req.params['id'];
      server.getTx(req.body, (err, tx) => {
        if (err) return returnError(err, res, req);
        res.json(tx);
        res.end();
      });
    });
  });

  router.get('/v1/txproposalsbyhash/:id/', (req, res) => {
    getServerWithAuth(req, res, server => {
      req.body.txid = req.params['id'];
      server.getTxByHash(req.body, (err, tx) => {
        if (err) return returnError(err, res, req);
        res.json(tx);
        res.end();
      });
    });
  });

  router.get('/v1/txhistory/', (req, res) => {
    getServerWithAuth(req, res, server => {
      const opts: {
        skip?: number;
        limit?: number;
        reverse?: boolean;
        includeExtendedInfo?: boolean;
        tokenAddress?: string;
        multisigContractAddress?: string;
      } = {};
      if (req.query.skip) opts.skip = +req.query.skip;
      if (req.query.limit) opts.limit = +req.query.limit;
      if (req.query.reverse == '1') opts.reverse = true;
      if (req.query.tokenAddress) opts.tokenAddress = req.query.tokenAddress as string;
      if (req.query.multisigContractAddress) {
        opts.multisigContractAddress = req.query.multisigContractAddress as string;
      }
      if (req.query.includeExtendedInfo == '1') opts.includeExtendedInfo = true;

      server.getTxHistory(opts, (err, txs) => {
        if (err) return returnError(err, res, req);
        res.json(txs);
        res.end();
      });
    });
  });
}
