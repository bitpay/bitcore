import express from 'express';
import * as Types from '../../types/expressapp';
import { TssKeyGen, TssSign } from '../tss';
import { authRequest } from './middleware/authRequest';
import { authTssRequest } from './middleware/authTssRequest';
import { createWalletLimiter } from './middleware/createWalletLimiter';
import { verifyTssMessage } from './middleware/verifyTssMessage';


interface TssRouterOpts {
  returnError: Types.ReturnErrorFn;
  opts: {
    ignoreRateLimiter?: boolean;
  }
};

export class TssRouter {
  router: express.Router;

  constructor(params: TssRouterOpts) {
    const { returnError, opts } = params;
    const router = express.Router();
    
    router.post('/v1/tss/keygen/:id', createWalletLimiter(opts), verifyTssMessage, async function(req, res) {
      try {
        const id = req.params.id;
        const { message, n, password } = req.body;
        const copayerId = req.headers['x-identity'];
        await TssKeyGen.processMessage({ id, message, n, password, copayerId });
        return res.send();
      } catch (err) {
        return returnError(err ?? 'unknown', res, req);
      }
    });

    router.get('/v1/tss/keygen/:id/:round', authTssRequest(), async function(req, res) {
      try {
        const { id, round } = req.params as { [key: string]: string };
        const copayerId = req.headers['x-identity'];
        if (round === 'secret') {
          const secret = await TssKeyGen.getBwsJoinSecret({ id, copayerId });
          return res.json({ secret });
        }
        const { messages, publicKey } = await TssKeyGen.getMessagesForParty({ id, round: parseInt(round), copayerId });
        return res.json({ messages, publicKey });
      } catch (err) {
        return returnError(err ?? 'unknown', res, req);
      }
    });

    router.post('/v1/tss/keygen/:id/store', authTssRequest(), async function(req, res) {
      try {
        const id = req.params.id;
        const copayerId = req.headers['x-identity'];
        const message = req.body;

        await TssKeyGen.storeKey({ id, message, copayerId });
        return res.send();
      } catch (err) {
        return returnError(err ?? 'unknown', res, req);
      }
    });

    router.post('/v1/tss/keygen/:id/secret', authTssRequest(), async function(req, res) {
      try {
        const id = req.params.id;
        const { secret } = req.body;
        const copayerId = req.headers['x-identity'];
        await TssKeyGen.storeBwsJoinSecret({ id, secret, copayerId });
        return res.send();
      } catch (err) {
        return returnError(err ?? 'unknown', res, req);
      }
    });

    router.get('/v1/tss/keygen/:id/secret', authTssRequest(), async function(req, res) {
      try {
        const id = req.params.id;
        const copayerId = req.headers['x-identity'];
        const secret = await TssKeyGen.getBwsJoinSecret({ id, copayerId });
        return res.json({ secret });
      } catch (err) {
        return returnError(err ?? 'unknown', res, req);
      }
    });

    router.post('/v1/tss/sign/:id', authRequest(), verifyTssMessage, async function(req, res) {
      try {
        const id = req.params.id;
        const { message, m } = req.body;
        const copayerId = req.headers['x-identity'];
        await TssSign.processMessage({ id, message, m, copayerId });
        return res.send();
      } catch (err) {
        return returnError(err ?? 'unknown', res, req);
      }
    });

    router.get('/v1/tss/sign/:id/:round', authTssRequest(), async function(req, res) {
      try {
        const { id, round } = req.params as { [key: string]: string };
        const copayerId = req.headers['x-identity'];
        const { messages, signature } = await TssSign.getMessagesForParty({ id, round: parseInt(round), copayerId });
        return res.json({ messages, signature });
      } catch (err) {
        return returnError(err ?? 'unknown', res, req);
      }
    });

    router.post('/v1/tss/sign/:id/store', authTssRequest(), async function(req, res) {
      try {
        const id = req.params.id;
        const { signature } = req.body;
        await TssSign.storeSignature({ id, signature });
        return res.send();
      } catch (err) {
        return returnError(err ?? 'unknown', res, req);
      }
    });

    this.router = router;
  }
};