import { Errors } from '../../errors/errordefinitions';
import { isCanonicalIndex, isWellFormedPubKey } from '../../model/tsskeygen';
import { error } from '../helpers';
import type express from 'express';

/**
 * Validate the shape of a KeyGen party registration body without reading any session or storage.
 * The slot must already be a canonical number: it is never coerced or truncated.
 * @returns A description of the first problem found, or null if the body is well-formed
 */
export function checkTssKeyGenRegistration(body: unknown): string | null {
  const { partyId, partyPubKey } = (body ?? {}) as { partyId?: unknown; partyPubKey?: unknown };
  if (!isCanonicalIndex(partyId) || partyId === 0) {
    return `Invalid partyId: ${String(partyId).slice(0, 32)}`;
  }
  if (typeof partyPubKey !== 'string' || !isWellFormedPubKey(partyPubKey.trim())) {
    return 'Invalid partyPubKey';
  }
  return null;
}

export const validateTssKeyGenRegistration: express.RequestHandler = function(req, res, next) {
  const problem = checkTssKeyGenRegistration(req.body);
  if (problem) {
    return error.returnError(Errors.TSS_INVALID_PARTY_DATA.withMessage(problem), res, req);
  }
  return next();
};
