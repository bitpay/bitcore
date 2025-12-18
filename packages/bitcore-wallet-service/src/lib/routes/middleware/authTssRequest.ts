import express from 'express';
import { Utils } from '../../common/utils';
import { ClientError } from '../../errors/clienterror';
import { Errors } from '../../errors/errordefinitions';
import { WalletService, checkRequired } from '../../server';
import { error } from '../helpers';
import { getCredentials, getMessage } from './authRequest';


/**
 * Middleware to authenticate TSS requests and attach the TSS session to the request.
 * It checks if the request has valid credentials, verifies the signature,
 * and retrieves the TSS session based on the request path.
 */
export function authTssRequest(): express.RequestHandler {

  return async function(req, res, next) {
    try {
      const storage = WalletService.getStorage();
      const credentials = getCredentials(req);
      if (!checkRequired(credentials, ['copayerId', 'signature'])) {
        throw Errors.NOT_AUTHORIZED;
      }
    
      const {
        copayerId,
        signature
      } = credentials;
      
      const { id } = req.params as { [key: string]: string };
      let session;
      let partyId = null;
      let pubKey = null;
      if (req.path.includes('/tss/keygen/')) {
        session = await storage.fetchTssKeyGenSession({ id });
        partyId = session?.participants.indexOf(copayerId);
        pubKey = partyId > -1 ? session.rounds[0][partyId].messages.publicKey : null;
      } else if (req.path.includes('/tss/sign/')) {
        session = await storage.fetchTssSigSession({ id });
        partyId = session?.participants.find(p => p.copayerId === copayerId)?.partyId;
        pubKey = partyId == null ? null : session.rounds[0].find(r => r.fromPartyId === partyId).messages.publicKey;
      }

      if (!session) {
        throw Errors.NOT_AUTHORIZED.withMessage('Session not found');
      }
      if (!pubKey) {
        throw Errors.NOT_AUTHORIZED.withMessage('Copayer not found in session');
      }

      const message = getMessage(req);
      const isValid = !!Utils.verifyMessage(message, signature, pubKey);
      if (!isValid) {
        throw Errors.NOT_AUTHORIZED.withMessage('Invalid signature');
      }
    
      req.session = session;
      return next();
    } catch (err) {
      if (err instanceof ClientError) {
        return error.returnError(err, res, req);
      }
      return error.returnError(new ClientError({ code: 'INTERNAL_ERROR' }), res, req);
    }
  };
};