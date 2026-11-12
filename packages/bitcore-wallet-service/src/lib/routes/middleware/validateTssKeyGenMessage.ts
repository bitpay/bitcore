import { Errors } from '../../errors/errordefinitions';
import { isCanonicalIndex } from '../../model/tsskeygen';
import { error } from '../helpers';
import type express from 'express';

/**
 * Highest round a client submits. The DKG library's final local result (round 4) is never posted: the client skips it
 *  once the keychain is ready, and the library's "ready" state (5) is not a submitted round either.
 */
export const MAX_SUBMITTED_ROUND = 3;

const isObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Validate the shape of a KeyGen message request body without reading any session or storage.
 * Cryptographic fields are left opaque for `verifyTssMessage` and the DKG library.
 * @returns A description of the first problem found, or null if the body is well-formed
 */
export function checkTssKeyGenMessage(body: unknown): string | null {
  const message = (body as { message?: unknown } | undefined)?.message;
  if (!isObject(message)) {
    return 'message must be an object';
  }
  const { partyId, round, broadcastMessages, p2pMessages } = message;
  if (!isCanonicalIndex(partyId)) {
    return 'Invalid partyId';
  }
  if (!isCanonicalIndex(round) || round > MAX_SUBMITTED_ROUND) {
    return 'Invalid round';
  }
  if (!Array.isArray(broadcastMessages) || !Array.isArray(p2pMessages)) {
    return 'broadcastMessages and p2pMessages must be arrays';
  }
  if (!broadcastMessages.length && !p2pMessages.length) {
    return 'message has no broadcast or p2p messages';
  }
  for (const m of broadcastMessages) {
    if (!isObject(m) || m.from !== partyId) {
      return 'Invalid broadcast message';
    }
    if (!isObject(m.payload) || typeof m.payload.message !== 'string' || typeof m.payload.signature !== 'string') {
      return 'Invalid broadcast message payload';
    }
  }
  for (const m of p2pMessages) {
    if (!isObject(m) || m.from !== partyId || !isCanonicalIndex(m.to) || m.to === m.from) {
      return 'Invalid p2p message';
    }
    if (typeof m.commitment !== 'string' || !isObject(m.payload) ||
      typeof m.payload.encryptedMessage !== 'string' || typeof m.payload.signature !== 'string') {
      return 'Invalid p2p message payload';
    }
  }
  return null;
}

export const validateTssKeyGenMessage: express.RequestHandler = function(req, res, next) {
  const problem = checkTssKeyGenMessage(req.body);
  if (problem) {
    return error.returnError(Errors.TSS_INVALID_MESSAGE.withMessage(problem), res, req);
  }
  return next();
};
