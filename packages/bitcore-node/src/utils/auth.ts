import { Request, Response } from 'express';
import { RequestHandler } from 'express-serve-static-core';
import logger from '../logger';
import { MongoBound } from '../models/base';
import { IWallet } from '../models/wallet';
import { ChainStateProvider } from '../providers/chain-state';
import { Config } from '../services/config';
import { ChainNetwork } from '../types/ChainNetwork';

const secp256k1 = require('secp256k1');
const bitcoreLib = require('bitcore-lib');

export interface VerificationPayload {
  message: string;
  pubKey: string;
  signature: string | string[] | undefined;
}
type SignedApiRequest = ChainNetwork & VerificationPayload;

export function verifyRequestSignature(params: VerificationPayload): boolean {
  const { message, pubKey, signature } = params;
  const pub = new bitcoreLib.PublicKey(pubKey).toBuffer();
  const messageHash = bitcoreLib.crypto.Hash.sha256sha256(Buffer.from(message));
  if (typeof signature === 'string') {
    return secp256k1.verify(messageHash, Buffer.from(signature, 'hex'), pub);
  } else {
    throw new Error('Signature must exist');
  }
}

type PreAuthRequest = {
  params: SignedApiRequest;
} & Request;

export type AuthenticatedRequest = {
  wallet?: MongoBound<IWallet>;
} & PreAuthRequest;

const authenticateMiddleware: RequestHandler = async (req: Request, res: Response, next: any) => {
  const { chain, network, pubKey } = (req.params as unknown) as SignedApiRequest;
  logger.debug('Authenticating request with pubKey: ', pubKey);
  let wallet;
  try {
    wallet = await ChainStateProvider.getWallet({ chain, network, pubKey });
  } catch (err) {
    return res.status(500).send('Problem authenticating wallet');
  }
  try {
    if (req.is('application/octet-stream')) {
      req.body = JSON.parse(req.body.toString());
    }
    if (!wallet) {
      return res.status(404).send('Wallet not found');
    }
    Object.assign(req, { wallet });
    const walletConfig = Config.for('api').wallets;
    if (walletConfig && walletConfig.allowUnauthenticatedCalls) {
      return next();
    }

    const validRequestSignature = verifyRequestSignature({
      message: [req.method, req.originalUrl, JSON.stringify(req.body)].join('|'),
      pubKey: wallet.pubKey,
      signature: req.headers['x-signature']
    });
    if (!validRequestSignature) {
      return res.status(401).send('Authentication failed');
    }
    return next();
  } catch (e) {
    return res.status(401).send('Authentication failed');
  }
};

export const Auth = {
  verifyRequestSignature,
  authenticateMiddleware
};
