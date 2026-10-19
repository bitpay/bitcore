import express from 'express';
import { Utils } from '../../common/utils';
import { ClientError } from '../../errors/clienterror';
import { Errors } from '../../errors/errordefinitions';
import { WalletService, checkRequired } from '../../server';
import { error } from '../helpers';
import { getCredentials, getMessage } from './authRequest';
import type { ITssKeyMessageObject, TssKeyGenModel } from '../../model/tsskeygen';
import type { ITssSigMessageObject, TssSigGenModel } from '../../model/tsssign';

function verifyMessage(req: express.Request, signature: string, pubKey: string) {
  const message = getMessage(req);
  const isValid = !!Utils.verifyMessage(message, signature, pubKey);
  if (!isValid) {
    throw Errors.NOT_AUTHORIZED.withMessage('Invalid signature');
  }
}

/**
 * Middleware to authenticate TSS key generation requests and attach the TSS session to the request.
 * It checks if the request has valid credentials, verifies the signature,
 * and retrieves the TSS session based on the request path.
 */
export function authTssKeyGenRequest(): express.RequestHandler {
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
      const body = req.body as { message: ITssKeyMessageObject | undefined };

      // Note: the copayer is not fetched from the db here bc it's not stored
      //  until the key generation session is done and the wallet gets created.

      const session: TssKeyGenModel = await storage.fetchTssKeyGenSession({ id });
      if (!session) {
        // This is a brand new session. Caller should be party 0 with the initial round message.
        if (body?.message?.round === 0 && body?.message?.partyId === 0) {
          const pubKey = body?.message?.publicKey;
          verifyMessage(req, signature, pubKey); // Self verification, but at least ensures that the caller owns the message's private key
          return next();
        } else {
          // Session should have been initialized by the client already in BWC > TssKeyGen.newKey()
          throw Errors.NOT_AUTHORIZED.withMessage('Session not found');
        }
      }
      const isRound0Msg = body?.message?.round === 0;
      const awaitingJoiners = session.participants.some(p => !p); // session.participants is initiated with n slots (initally null) that get populated as participants join
      const participantIdx = session.participants.indexOf(copayerId); // equals -1 if the copayer has not joined yet
      if (participantIdx === -1 && session.schemeVersion >= 1.2) {
        // Check session.authPublicKeys to ensure initiator registered this participant
        const msgPubKey = body?.message?.publicKey;
        if (!msgPubKey) {
          throw Errors.NOT_AUTHORIZED;
        }
        const _participantIdx = session.authPublicKeys.indexOf(msgPubKey);
        if (_participantIdx === -1) {
          throw Errors.NOT_AUTHORIZED;
        }
        if (session.participants[_participantIdx]) {
          throw Errors.NOT_AUTHORIZED;
        }
      }
      const partyId = participantIdx > -1
        ? participantIdx
        : (awaitingJoiners && isRound0Msg)
          ? body?.message?.partyId // if participant has not joined session yet, use the partyId from the initial round message (verified below)
          : -1;
      
      let pubKey: string = null;
      if (session?.schemeVersion <= 1.1) {
        // session.authPublicKeys was not added until 1.2, so fetch public key from the first round messages instead (old way)
        pubKey = partyId > -1 ? session.rounds[0].find(r => r.fromPartyId === partyId)?.messages.publicKey : null;
        if (!pubKey && participantIdx === -1 && partyId > -1) {
          // Joining party hasn't submitted its round 0 message yet and legacy sessions have no registration,
          //  so use the joining message's public key (verifyTssMessage verifies the message's payload against it)
          pubKey = body?.message?.publicKey;
        }
      } else {
        // authPublicKeys is set by the session leader, so this will verify that the leader and the calling participant here are on the same page
        pubKey = partyId > -1 ? session?.authPublicKeys[partyId] : null;
      }

      if (!pubKey) {
        throw Errors.NOT_AUTHORIZED.withMessage('Copayer not found in session');
      }
      if (session.isExpired()) {
        throw Errors.TSS_SESSION_EXPIRED;
      }

      verifyMessage(req, signature, pubKey);
    
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

export function authTssSignRequest(): express.RequestHandler {
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
      const body = req.body as { message: ITssSigMessageObject | undefined };
      // Only some requests carry a body.message (e.g. POST /store only sends the final signature).
      //  Omitting it is safe since routes that don't receive a message don't consume one.
      const verifyMsg = !!body?.message;

      const copayer = await storage.fetchCopayerLookup(copayerId);
      if (!copayer) {
        throw Errors.NOT_AUTHORIZED.withMessage('Copayer not found');
      }
      const pubKey = copayer.requestPubKeys[0].key;
      if (verifyMsg && pubKey !== body?.message?.publicKey) {
        throw Errors.NOT_AUTHORIZED.withMessage('Invalid public key');
      }

      const session: TssSigGenModel = await storage.fetchTssSigSession({ id });
      // If !session, it needs to be initiated
      if (session) {
        const party = session?.participants.find(p => p.copayerId === copayerId);
        if (!party) {
          throw Errors.NOT_AUTHORIZED.withMessage('Copayer not found in session');
        }
        if (verifyMsg && party.partyId !== body?.message?.partyId) {
          throw Errors.NOT_AUTHORIZED.withMessage('Copayer not found in session');
        }
        if (session.isExpired()) {
          throw Errors.TSS_SESSION_EXPIRED;
        }

        req.session = session;
      } else if (body?.message?.round !== 0) {
        throw Errors.TSS_SESSION_NOT_FOUND;
      }
      
      verifyMessage(req, signature, pubKey);
      return next();
    } catch (err) {
      if (err instanceof ClientError) {
        return error.returnError(err, res, req);
      }
      return error.returnError(new ClientError({ code: 'INTERNAL_ERROR' }), res, req);
    }
  };
};