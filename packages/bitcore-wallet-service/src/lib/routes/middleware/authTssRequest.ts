import express from 'express';
import * as Types from '../../../types/expressapp';
import { Utils } from '../../common/utils';
import { ClientError } from '../../errors/clienterror';
import { Errors } from '../../errors/errordefinitions';
import { checkRequired, WalletService } from '../../server';
import { error } from '../helpers';
import { getCredentials, getMessage } from './authRequest';


export function authTssRequest(opts?: Types.AuthRequestOpts): express.RequestHandler {
  opts = opts || {};

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
      const session = await storage.fetchTssKeygen({ id });
      if (!session) {
        throw Errors.NOT_AUTHORIZED.withMessage('Session not found');
      }
      if (!session.participants.includes(copayerId)) {
        throw Errors.NOT_AUTHORIZED.withMessage('Copayer not found in session');
      }

      const message = getMessage(req);
      const partyId = session.participants.indexOf(copayerId);
      const pubKey = session.rounds[0][partyId].messages.publicKey;
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