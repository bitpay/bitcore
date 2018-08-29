import { Request, Response, Router } from 'express';
import { ChainNetwork } from '../../types/ChainNetwork';
import { IWallet } from '../../models/wallet';
import { RequestHandler } from 'express-serve-static-core';
import { ChainStateProvider } from '../../providers/chain-state';
import logger from '../../logger';
import { MongoBound } from '../../models/base';
const router = Router({ mergeParams: true });
const secp256k1 = require('secp256k1');
const bitcoreLib = require('bitcore-lib');

type VerificationPayload = {
  message: string;
  pubKey: string;
  signature: string | string[] | undefined;
};
type SignedApiRequest = ChainNetwork & VerificationPayload;

type PreAuthRequest = {
  params: SignedApiRequest;
} & Request;

type AuthenticatedRequest = {
  wallet?: MongoBound<IWallet>;
} & PreAuthRequest;

const verifyRequestSignature = (params: VerificationPayload): boolean => {
  const { message, pubKey, signature } = params;
  const pub = new bitcoreLib.PublicKey(pubKey).toBuffer();
  const messageHash = bitcoreLib.crypto.Hash.sha256sha256(Buffer.from(message));
  if (typeof signature === 'string') {
    return secp256k1.verify(messageHash, Buffer.from(signature, 'hex'), pub);
  } else {
    throw new Error('Signature must exist');
  }
};

const authenticate: RequestHandler = async (req: PreAuthRequest, res: Response, next: any) => {
  const { chain, network, pubKey } = req.params as SignedApiRequest;
  logger.debug('Authenticating request with pubKey: ', pubKey);
  const wallet = await ChainStateProvider.getWallet({ chain, network, pubKey });
  if (req.is('application/octet-stream')) {
    req.body = JSON.parse(req.body.toString());
  }
  if (!wallet) {
    return res.status(404).send(new Error('Wallet not found'));
  }
  Object.assign(req, { wallet });
  try {
    const validRequestSignature = verifyRequestSignature({
      message: [req.method, req.originalUrl, JSON.stringify(req.body)].join('|'),
      pubKey: wallet.pubKey,
      signature: req.headers['x-signature']
    });
    if (!validRequestSignature) {
      return res.status(401).send(new Error('Authentication failed'));
    }
    return next();
  } catch (e) {
    return res.status(401).send(new Error('Authentication failed'));
  }
};

// create wallet
router.post('/', async function(req, res) {
  let { chain, network } = req.params;
  let { name, pubKey, path, singleAddress } = req.body;
  try {
    const existingWallet = await ChainStateProvider.getWallet({
      chain,
      network,
      pubKey
    });
    if (existingWallet) {
      return res.status(200).send('Wallet already exists');
    }
    let result = await ChainStateProvider.createWallet({
      chain,
      network,
      singleAddress,
      name,
      pubKey,
      path
    });
    return res.send(result);
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get('/:pubKey/addresses/missing', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    let { chain, network, pubKey } = req.params;
    let payload = {
      chain,
      network,
      pubKey,
      stream: res
    };
    return ChainStateProvider.streamMissingWalletAddresses(payload);
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get('/:pubKey/addresses', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { wallet } = req;
    let { chain, network } = req.params;
    let { limit } = req.query;
    let payload = {
      chain,
      network,
      walletId: wallet!._id,
      limit,
      stream: res
    };
    return ChainStateProvider.streamWalletAddresses(payload);
  } catch (err) {
    return res.status(500).send(err);
  }
});

// update wallet
router.post('/:pubKey', authenticate, async (req: AuthenticatedRequest, res) => {
  let { chain, network } = req.params;
  let addressLines: { address: string }[] = req.body;
  try {
    let addresses = addressLines.map(({ address }) => address);
    await ChainStateProvider.updateWallet({
      chain,
      network,
      wallet: req.wallet!,
      addresses
    });
    return res.send({ success: true });
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get('/:pubKey/transactions', authenticate, async (req: AuthenticatedRequest, res) => {
  let { chain, network } = req.params;
  try {
    return ChainStateProvider.streamWalletTransactions({
      chain,
      network,
      wallet: req.wallet!,
      stream: res,
      args: req.query
    });
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get('/:pubKey/balance', authenticate, async (req: AuthenticatedRequest, res) => {
  let { chain, network } = req.params;
  try {
    const result = await ChainStateProvider.getWalletBalance({
      chain,
      network,
      wallet: req.wallet!
    });
    return res.send((result && result[0]) || { balance: 0 });
  } catch (err) {
    return res.status(500).json(err);
  }
});

router.get('/:pubKey/utxos', authenticate, async (req: AuthenticatedRequest, res) => {
  let { chain, network } = req.params;
  let { limit = 1000 } = req.query;
  try {
    return ChainStateProvider.streamWalletUtxos({
      chain,
      network,
      wallet: req.wallet!,
      limit,
      stream: res,
      args: req.query
    });
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get('/:pubKey', authenticate, async function(req: AuthenticatedRequest, res: Response) {
  try {
    let wallet = req.wallet;
    return res.send(wallet);
  } catch (err) {
    return res.status(500).send(err);
  }
});

module.exports = {
  router: router,
  path: '/wallet'
};
