import { Request, Response } from 'express';
import logger from '../logger';
import { Config } from '../services/config';
import { Auth } from '../utils/auth';

/**
 * Shared-key auth for the wallet stats API. Consumers sign
 * [method, originalUrl, JSON.stringify(body)].join('|') with a secp256k1 key
 * whose pubkey is listed in services.walletStats.api.authKeys, and send the
 * signature hex in x-signature. No wallet is involved, so this never touches
 * the database.
 */
export function walletStatsAuth(req: Request, res: Response, next: any) {
  const apiConfig = Config.for('walletStats').api;
  if (!apiConfig || apiConfig.disabled) {
    return res.status(404).send('Not found');
  }

  const signature = req.headers['x-signature'];
  const authKeys = apiConfig.authKeys || [];
  const message = [req.method, req.originalUrl, JSON.stringify(req.body)].join('|');

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
