import express from 'express';
import * as Types from '../../types/expressapp';
import * as TssKeygen from '../tss';
import { authTssRequest } from './middleware/authTssRequest';
import { verifyTssMessage } from './middleware/verifyTssMessage';


interface TssRouterOpts {
  getServerWithAuth: Types.GetServerWithAuthFn;
  returnError: Types.ReturnErrorFn;
  getServer: Types.GetServerFn;
};

export class TssRouter {
  router: express.Router;

  constructor(opts: TssRouterOpts) {
    const { getServerWithAuth, returnError, getServer } = opts;
    const router = express.Router();
    
    router.post('/v1/tss/keygen/:id', verifyTssMessage, async function(req, res) {
      try {
        const id = req.params.id;
        const msg = req.body;
        const copayerId = req.headers['x-identity'];
        await TssKeygen.processMessage({ id, message: msg, copayerId });
        return res.send();
      } catch (err) {
        return returnError(err ?? 'unknown', res, req);
      }
    });

    router.get('/v1/tss/keygen/:id/:round', authTssRequest(), async function(req, res) {
      try {
        const { id, round } = req.params as { [key: string]: string };
        const copayerId = req.headers['x-identity']; // ??
        const messages = await TssKeygen.getMessagesForParty({ id, round, copayerId });
        return res.json({ messages });
      } catch (err) {
        return returnError(err ?? 'unknown', res, req);
      }
    });

    router.post('/v1/tss/keygen/:id/store', authTssRequest(), async function(req, res) {
      try {
        const id = req.params.id;
        const message = req.body;

        await TssKeygen.storePublicKey({ id, message });
        return res.send();
      } catch (err) {
        return returnError(err ?? 'unknown', res, req);
      }
    });

    this.router = router;
  }
};