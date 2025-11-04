import express from 'express';
import * as Types from '../../../types/expressapp';
import { Utils } from '../../common/utils';
import { ClientError } from '../../errors/clienterror';
import { Errors } from '../../errors/errordefinitions';
import { Copayer } from '../../model';
import { WalletService, checkRequired } from '../../server';
import { Storage } from '../../storage';
import { error } from '../helpers';

export function getCredentials(req: express.Request): Types.ApiCredentials {
  const identity = req.header('x-identity');
  if (!identity) return;

  return {
    copayerId: identity,
    signature: req.header('x-signature'),
    session: req.header('x-session')
  };
};

export function getMessage(req: express.Request): string {
  return req.method.toLowerCase() + '|' + req.url + '|' + JSON.stringify(req.body);
};

async function withSession(storage: Storage, opts): Promise<Copayer> {
  if (!checkRequired(opts, ['copayerId', 'session'])) {
    return;
  }

  const copayer = await new Promise<Copayer>((resolve, reject) => {
    storage.getSession(opts.copayerId, (err, s) => {
      if (err) {
        return reject(err);
      }

      const isValid = s && s.id === opts.session && s.isValid();
      if (!isValid) {
        return reject(Errors.NOT_AUTHORIZED.withMessage('Session expired'));
      }

      storage.fetchCopayerLookup(opts.copayerId, (err, copayer) => {
        if (err) {
          return reject(err);
        }
        if (!copayer) {
          return reject(Errors.NOT_AUTHORIZED.withMessage('Copayer not found'));
        }

        return resolve(copayer);
      });
    });
  });

  return copayer;
};

async function withSignature(storage: Storage, opts): Promise<Copayer> {
  if (!checkRequired(opts, ['copayerId', 'message', 'signature'])) {
    return;
  }

  const copayer = await new Promise<Copayer>((resolve, reject) => {
    storage.fetchCopayerLookup(opts.copayerId, (err, copayer) => {
      if (err) {
        return reject(err);
      }
      if (!copayer) {
        return reject(Errors.NOT_AUTHORIZED.withMessage('Copayer not found'));
      }
      return resolve(copayer);
    });
  });

  const isValid = !!copayer.requestPubKeys.find(pubKey => Utils.verifyMessage(opts.message, opts.signature, pubKey.key));
  if (!isValid) {
    throw Errors.NOT_AUTHORIZED.withMessage('Invalid signature');
  }

  return copayer;
};


export function authRequest(opts?: Types.AuthRequestOpts): express.RequestHandler {
  opts = opts || {};

  return async function(req, res, next) {
    try {
      const storage = WalletService.getStorage();
      const credentials = getCredentials(req);
      if (!credentials) {
        throw Errors.NOT_AUTHORIZED;
      }

    
      const auth = {
        copayerId: credentials.copayerId,
        message: getMessage(req),
        signature: credentials.signature,
        clientVersion: req.header('x-client-version'),
        userAgent: req.header('user-agent'),
        walletId: req.header('x-wallet-id'),
        session: opts.allowSession ? credentials.session : undefined
      };

      const copayer = await (auth.session ? withSession(storage, auth) : withSignature(storage, auth));
      req.copayer = copayer;
    } catch (err) {
      if (err instanceof ClientError) {
        return error.returnError(err, res, req);
      }
      return error.returnError(new ClientError({ code: 'INTERNAL_ERROR' }), res, req);
    }

    return next();
  };
};