import { utils as TssUtils } from '@bitpay-labs/bitcore-tss';
import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { API } from './api';

const $ = BitcoreLib.util.preconditions;
const { ECDSA, Hash, Signature } = BitcoreLib.crypto;

/** Identifies a signed payload as a TSS wallet join delivery, so it cannot be mistaken for another encrypted object */
export const JOIN_DELIVERY_PURPOSE = 'tss-wallet-join';
export const JOIN_DELIVERY_VERSION = 1;

/**
 * Normalize a public key (hex string in any valid encoding, or a PublicKey) to compressed lowercase hex.
 * Throws `Invalid <name>` if the value is not a valid secp256k1 public key.
 */
export function normalizePubKey(pubKey: string | BitcoreLib.PublicKey, name = 'public key'): string {
  try {
    const pk = pubKey instanceof BitcoreLib.PublicKey ? pubKey : new BitcoreLib.PublicKey(pubKey);
    return BitcoreLib.PublicKey.fromPoint(pk.point, true).toString();
  } catch {
    throw new Error('Invalid ' + name);
  }
}

/**
 * The ceremony a join delivery belongs to, as known locally by the party that sends or receives it.
 * Everything here comes from local state (the invitation, the session, the DKG result), never from BWS.
 */
export interface JoinDeliveryContext {
  sessionId: string;
  /** The recipient's party ID */
  partyId: number;
  /** The recipient's request public key, as retained from the invitation exchange */
  requestPubKey: string;
  chain: string;
  /** Defaults to the lowercased chain, which is how TSS wallets are created */
  coin?: string;
  network: string;
  /** The ceremony threshold. The BWS wallet normalizes these to 1/1, so they cannot be taken from the secret. */
  m: number;
  n: number;
  /** The common keychain from the locally completed DKG */
  commonKeyChain: string;
}

/** What BWS stores and serves for one recipient. Both fields are opaque to BWS. */
export interface JoinDelivery {
  encryptedMessage: string;
  signature: string;
}

interface JoinDeliveryPayload {
  purpose: string;
  version: number;
  sessionId: string;
  partyId: number;
  requestPubKey: string;
  chain: string;
  coin: string;
  network: string;
  m: number;
  n: number;
  commonKeyChain: string;
  secret: string;
}

/**
 * Encrypt the ordinary join secret for one recipient, and sign it so the recipient can authenticate the creator.
 * Each call uses a fresh random IV, so repeated calls for the same payload produce different ciphertext.
 * @param params.context The recipient and ceremony the delivery is for
 * @param params.secret The ordinary join secret (`API._buildSecret`) of the created wallet
 * @param params.creatorPrivKey The creator's request private key
 */
export function encryptJoinDelivery(params: {
  context: JoinDeliveryContext;
  secret: string;
  creatorPrivKey: BitcoreLib.PrivateKey | string;
}): JoinDelivery {
  const { context, secret, creatorPrivKey } = params;
  $.checkArgument(creatorPrivKey, 'Missing creatorPrivKey');
  const payload = toPayload(context, secret);
  assertValidSecret(secret, payload.coin, payload.network);

  // The records are the same as `TssUtils.encryptAndDetachSignData` produces, but that helper leaves
  // a base64 copy of the plaintext behind. Here every plaintext buffer is one we can zero.
  const plaintext = Buffer.from(JSON.stringify(payload));
  try {
    return {
      encryptedMessage: TssUtils.encrypt(plaintext, payload.requestPubKey, creatorPrivKey).toString('base64'),
      signature: signPlaintext(plaintext, creatorPrivKey)
    };
  } finally {
    plaintext.fill(0);
  }
}

/**
 * Decrypt a join delivery and verify that it is the creator's, for this recipient, and for this ceremony.
 * @param params.delivery The record served by BWS
 * @param params.recipientPrivKey The recipient's original request private key
 * @param params.creatorPubKey The creator's request public key, retained from the trusted invitation (never from BWS)
 * @param params.expected The recipient's local view of the ceremony
 * @returns The validated ordinary join secret, to be passed to `API.joinWallet`
 */
export function decryptJoinDelivery(params: {
  delivery: JoinDelivery;
  recipientPrivKey: BitcoreLib.PrivateKey | string;
  creatorPubKey: string;
  expected: JoinDeliveryContext;
}): string {
  const { delivery, recipientPrivKey, creatorPubKey, expected } = params;
  $.checkArgument(recipientPrivKey, 'Missing recipientPrivKey');
  const trustedCreatorKey = normalizePubKey(creatorPubKey, 'creatorPubKey');
  const want = toPayload(expected, '');

  if (!delivery || typeof delivery.encryptedMessage !== 'string' || typeof delivery.signature !== 'string') {
    throw new Error('Invalid join delivery');
  }

  let plaintext: Buffer;
  try {
    plaintext = TssUtils.decrypt(Buffer.from(delivery.encryptedMessage, 'base64'), trustedCreatorKey, recipientPrivKey);
  } catch {
    throw new Error('Join delivery could not be decrypted');
  }

  let payload: JoinDeliveryPayload;
  try {
    if (!verifyPlaintext(plaintext, delivery.signature, trustedCreatorKey)) {
      throw new Error('Join delivery signature verification failed');
    }

    try {
      payload = JSON.parse(plaintext.toString());
    } catch {
      throw new Error('Invalid join delivery contents');
    }
  } finally {
    plaintext.fill(0);
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid join delivery contents');
  }

  if (payload.purpose !== JOIN_DELIVERY_PURPOSE) {
    throw new Error('Join delivery has the wrong purpose');
  }
  if (payload.version !== JOIN_DELIVERY_VERSION) {
    throw new Error('Unsupported join delivery version');
  }
  // Compare the context field by field. Only field names are reported, never values.
  const contextFields = ['sessionId', 'partyId', 'requestPubKey', 'chain', 'coin', 'network', 'm', 'n', 'commonKeyChain'] as const;
  for (const field of contextFields) {
    if (payload[field] !== want[field]) {
      throw new Error(`Join delivery ${field} does not match`);
    }
  }
  assertValidSecret(payload.secret, want.coin, want.network);
  return payload.secret;
}

/**
 * HELPERS
 */
/**
 * The secret parser is lenient (it defaults an unknown network to livenet and a missing coin to btc,
 * and accepts a short wallet ID), so require the secret to be exactly what the ordinary builder would produce
 * for what it parses to, and to hold a full wallet ID.
 * Throws without including the secret.
 */
function assertValidSecret(secret: unknown, coin: string, network: string): void {
  if (typeof secret !== 'string' || !secret) {
    throw new Error('Invalid join secret');
  }
  let parsed: ReturnType<typeof API.parseSecret>;
  try {
    parsed = API.parseSecret(secret);
  } catch {
    throw new Error('Invalid join secret');
  }

  /**
   * Require a full wallet ID: 32 lowercase hex digits in UUID layout.
   * parseSecret also accepts shorter IDs and inserts separators for missing groups (e.g. `12345678----`).
   */
  const WALLET_ID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (!WALLET_ID_FORMAT.test(parsed.walletId) ||
    API._buildSecret(parsed.walletId, parsed.walletPrivKey, parsed.coin, parsed.network) !== secret) {
    throw new Error('Invalid join secret');
  }
  if (parsed.coin !== coin) {
    throw new Error('Join secret coin does not match the ceremony');
  }
  if (parsed.network !== network) {
    throw new Error('Join secret network does not match the ceremony');
  }
}

function toPayload(context: JoinDeliveryContext, secret: string): JoinDeliveryPayload {
  const { sessionId, partyId, requestPubKey, chain, network, m, n, commonKeyChain } = context;
  $.checkArgument(sessionId && typeof sessionId === 'string', 'Missing sessionId');
  $.checkArgument(Number.isInteger(partyId) && partyId > 0, 'partyId must be a positive integer');
  $.checkArgument(chain && typeof chain === 'string', 'Missing chain');
  $.checkArgument(network && typeof network === 'string', 'Missing network');
  $.checkArgument(Number.isInteger(m) && Number.isInteger(n) && m >= 1 && m <= n, 'm and n must be integers with 1 <= m <= n');
  $.checkArgument(partyId < n, 'partyId must be less than n');
  $.checkArgument(commonKeyChain && typeof commonKeyChain === 'string', 'Missing commonKeyChain');
  return {
    purpose: JOIN_DELIVERY_PURPOSE,
    version: JOIN_DELIVERY_VERSION,
    sessionId,
    partyId,
    requestPubKey: normalizePubKey(requestPubKey, 'requestPubKey'),
    chain: chain.toLowerCase(),
    coin: (context.coin || chain).toLowerCase(),
    network,
    m,
    n,
    commonKeyChain,
    secret
  };
}

/**
 * Sign the plaintext the same way `TssUtils.detachSignData` does (double SHA-256, DER signature as a string),
 * without the helper's base64 copy of the plaintext. The digest is derived from the secret, so it is wiped too.
 */
function signPlaintext(plaintext: Buffer, privKey: BitcoreLib.PrivateKey | string): string {
  // zeroing digest not required - the digested plaintext includes a randomly-generated string
  const digest = Hash.sha256sha256(plaintext);
  const key = privKey instanceof BitcoreLib.PrivateKey ? privKey : new BitcoreLib.PrivateKey(privKey);
  return ECDSA.sign(digest, key).toString();
}

/** Counterpart of `signPlaintext`; compatible with `TssUtils.verifySignedData` */
function verifyPlaintext(plaintext: Buffer, signature: string, pubKey: string): boolean {
  // zeroing digest not required - the digested plaintext includes a randomly-generated string
  const digest = Hash.sha256sha256(plaintext);
  let parsedSignature: ReturnType<typeof Signature.fromString>;
  try {
    parsedSignature = Signature.fromString(signature);
  } catch {
    throw new Error('Invalid join delivery signature');
  }
  return ECDSA.verify(digest, parsedSignature, new BitcoreLib.PublicKey(pubKey));
}