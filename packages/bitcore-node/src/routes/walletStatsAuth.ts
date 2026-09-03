import { Request, Response } from 'express';
import logger from '../logger';
import { Config } from '../services/config';
import { Auth } from '../utils/auth';
import { setPrivateCache } from './walletStatsUtils';

/**
 * How far a request's x-timestamp may sit from our clock. Wide enough for
 * ordinary clock drift between the consumer and this node, short enough that a
 * captured request stops working almost immediately.
 */
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

/**
 * Shared-key auth for the wallet stats API. Consumers sign
 * [method, originalUrl, JSON.stringify(body), timestamp].join('|') with a
 * secp256k1 key whose pubkey is listed in services.walletStats.api.authKeys,
 * and send the signature hex in x-signature with the same epoch-millisecond
 * timestamp in x-timestamp. Signing the timestamp is what makes a captured
 * request useless once it falls outside the window: an attacker cannot move the
 * timestamp forward without invalidating the signature. No wallet is involved,
 * so this never touches the database.
 */
export function walletStatsAuth(req: Request, res: Response, next: any) {
  // Rejections are per-caller too: without this they inherit the global s-maxage and a
  // shared cache keyed on url alone could hand a stored 401 to a properly signed request.
  setPrivateCache(res);
  const apiConfig = Config.for('walletStats').api;
  if (!apiConfig || apiConfig.disabled) {
    return res.status(404).json({ error: 'Not found' });
  }

  const signature = req.headers['x-signature'];
  const timestamp = req.headers['x-timestamp'];
  if (!signature || typeof timestamp !== 'string' || !/^\d+$/.test(timestamp)) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
  if (Math.abs(Date.now() - Number(timestamp)) > MAX_TIMESTAMP_SKEW_MS) {
    return res.status(401).json({ error: 'Authentication failed' });
  }

  const authKeys = apiConfig.authKeys || [];
  const message = [req.method, req.originalUrl, JSON.stringify(req.body), timestamp].join('|');

  for (const pubKey of authKeys) {
    try {
      if (Auth.verifyRequestSignature({ message, pubKey, signature })) {
        return next();
      }
    } catch (e: any) {
      logger.debug('Wallet stats signature check failed: %o', e?.message || e);
    }
  }
  return res.status(401).json({ error: 'Authentication failed' });
}
