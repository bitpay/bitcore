import { EventEmitter } from 'events';
import { ECDSA, ECIES, utils as TssUtils } from '@bitpay-labs/bitcore-tss';
import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { API as Client, CreateWalletOpts } from './api';
import { Constants, Encryption, type Network, Utils } from './common';
import { Credentials } from './credentials';
import { Errors } from './errors';
import { ExportedKey, Key, KeyAlgorithm, PasswordMaybe } from './key';
import { Request, RequestResponse, getRequestErrorStatus, isTransientRequestError } from './request';
import { JOIN_DELIVERY_VERSION, decryptJoinDelivery, encryptJoinDelivery, normalizePubKey } from './tssdelivery';

const $ = BitcoreLib.util.preconditions;

const { TSS_KEYGEN_VERSION } = Constants;

/** Marks an exported session as the wrapper format. A legacy export starts with the session ID, which is never this. */
const SESSION_WRAPPER_PREFIX = 'tsskeygen.1.';
const SESSION_WRAPPER_VERSION = 1;

/** Only used for delivery publication and reads that are safe to repeat after a server failure. */
function isRetryableDeliveryRequestError(err: unknown): boolean {
  // isTransientError handles all specific rejections from Request.doRequest
  // 500 errors from BWS with bodies are storable/retrievable and considered retryable
  return getRequestErrorStatus(err) === 500 || isTransientRequestError(err);
}

export interface ITssKeyGenConstructorParams {
  /**
   * Chain this key is for (e.g. 'btc', 'bch', 'eth')
   */
  chain: string;
  /**
   * Network this key is for (e.g. 'livenet', 'testnet', 'regtest')
   */
  network: Network;
  /**
   * URL of the BWS server
   */
  baseUrl: string;
  /**
   * Key used for seeding generation, signing, and encrypting payloads
   */
  key: Key;
  /**
   * Password for `key` (if encrypted)
   */
  password?: string;
  /**
   * Pre-defined Request object for making HTTP requests.
   * For testing only
   */
  request?: Request;
  /**
   * Backup your encrypted key share to the server.
   * This allows for portability and recoverability with your xPrivKey.
   * Default: false
   * DISABLED
   */
  // backupKeyShare?: boolean;
};

export interface ITssKey extends Key {
  keychain: {
    privateKeyShare?: Buffer;
    privateKeyShareEncrypted?: string;
    reducedPrivateKeyShare?: Buffer;
    reducedPrivateKeyShareEncrypted?: string;
    commonKeyChain: string;
  };
  metadata: {
    id: string;
    m: number;
    n: number;
    partyId: number;
  };
};

export interface TssExportedKey extends ExportedKey {
  keychain: ITssKey['keychain'];
};

export class TssKey extends Key implements ITssKey {
  keychain: ITssKey['keychain'];
  metadata: ITssKey['metadata'];
  credentials: Credentials;
  tssXPubKey: string;

  constructor(obj: ITssKey) {
    super({ seedType: 'object', seedData: obj });
    this.keychain = obj.keychain;
    this.metadata = obj.metadata;
  }

  toObj(): ITssKey {
    return {
      ...super.toObj(),
      // Create de-referenced copies
      keychain: {
        privateKeyShare: this.keychain.privateKeyShare ? Buffer.from(this.keychain.privateKeyShare) : undefined,
        privateKeyShareEncrypted: this.keychain.privateKeyShareEncrypted,
        reducedPrivateKeyShare: this.keychain.reducedPrivateKeyShare ? Buffer.from(this.keychain.reducedPrivateKeyShare) : undefined,
        reducedPrivateKeyShareEncrypted: this.keychain.reducedPrivateKeyShareEncrypted,
        commonKeyChain: this.keychain.commonKeyChain
      } as ITssKey['keychain'],
      metadata: {
        id: this.metadata.id,
        m: this.metadata.m,
        n: this.metadata.n,
        partyId: this.metadata.partyId
      } as ITssKey['metadata']
    };
  }

  createCredentials(
    password: PasswordMaybe,
    opts: {
      chain?: string;
      coin?: string;
      network: string;
      account: number;
      addressType?: string;
      walletPrivKey?: string;
      algo?: 'EDDSA' | 'ECDSA';
    }
  ): Credentials {
    this.tssXPubKey = this.getXPubKey(opts.network);
    // n is always 1 for TSS keys since they act like single-sig wallets
    const c = super.createCredentials(password, { ...opts, n: 1, tssXPubKey: this.tssXPubKey });
    this.credentials = c;
    this.credentials.m = 1;
    return c;
  }

  getXPubKey(network?: string): string {
    const publicKey = this.keychain.commonKeyChain.substring(0, 66);
    const chainCode = this.keychain.commonKeyChain.substring(66);
    const xPubKey = new BitcoreLib.HDPublicKey({
      network: BitcoreLib.Networks.get(network) || 'testnet',
      depth: 0,
      parentFingerPrint: 0,
      childIndex: 0,
      publicKey,
      chainCode
    });
    return xPubKey.toString();
  }

  isKeyChainEncrypted(): boolean {
    return !!this.keychain.privateKeyShareEncrypted;
  }

  get(password: PasswordMaybe, algo?: KeyAlgorithm): TssExportedKey {
    const keyObj = {
      ...super.get(password, algo),
      keychain: !this.isKeyChainEncrypted() ? { ...this.keychain } : {
        privateKeyShare: Encryption.decryptWithPassword(this.keychain.privateKeyShareEncrypted, password),
        reducedPrivateKeyShare: Encryption.decryptWithPassword(this.keychain.reducedPrivateKeyShareEncrypted, password),
        commonKeyChain: this.keychain.commonKeyChain,
      }
    };
    return keyObj;
  }

  encrypt(password: string, opts?: { iter?: number; ks?: number }) {
    if (!this.isPrivKeyEncrypted()) {
      super.encrypt(password, opts);
    } else if (!this.checkPassword(password)) {
      throw new Error('Private key is already encrypted but with a different password');
    }
    if (this.isKeyChainEncrypted()) {
      throw new Error('Keychain is already encrypted');
    }
    this.keychain.privateKeyShareEncrypted = JSON.stringify(Encryption.encryptWithPassword(this.keychain.privateKeyShare, password, opts));
    this.keychain.reducedPrivateKeyShareEncrypted = JSON.stringify(Encryption.encryptWithPassword(this.keychain.reducedPrivateKeyShare, password, opts));
    // remove the private data
    this.keychain.privateKeyShare.fill(0);
    this.keychain.privateKeyShare = null;
    this.keychain.reducedPrivateKeyShare.fill(0);
    this.keychain.reducedPrivateKeyShare = null;
  }

  decrypt(password: string) {
    try {
      super.decrypt(password);
    } catch (e) {
      if (e.message !== 'Private key is not encrypted') {
        throw e;
      }
    }
    if (this.isKeyChainEncrypted()) {
      this.keychain.privateKeyShare = Encryption.decryptWithPassword(this.keychain.privateKeyShareEncrypted, password);
      this.keychain.reducedPrivateKeyShare = Encryption.decryptWithPassword(this.keychain.reducedPrivateKeyShareEncrypted, password);
      // remove the encrypted data
      this.keychain.privateKeyShareEncrypted = null;
      this.keychain.reducedPrivateKeyShareEncrypted = null;
    }
  }
};

/**
 * Check the ceremony fields of a decrypted join code. A correctly encrypted code is not necessarily a well-formed one,
 * and its fields become ceremony state and (via the creator key) trusted delivery state.
 * Fields may be undefined if the code had too few of them.
 */
function assertValidJoinCode(fields: Partial<Omit<ParsedJoinCode, 'extra' | 'creatorPubKey'>>): void {
  const { id, partyId, chain, network, m, n } = fields;
  const fail = (reason: string): never => { throw new Error('Invalid join code: ' + reason); };
  const toInt = (name: string, value?: string) => {
    const int = /^\d+$/.test(value ?? '') ? Number(value) : NaN;
    return Number.isSafeInteger(int) ? int : fail(`${name} must be a non-negative integer`);
  };

  if (!id) fail('missing session id');
  if (!chain) fail('missing chain');
  if (!Utils.isValidNetwork(network)) fail('unknown network');
  const mInt = toInt('m', m);
  const nInt = toInt('n', n);
  const partyInt = toInt('partyId', partyId);
  if (mInt < 1 || mInt > nInt) fail('m must be in [1. n]');
  if (partyInt < 1 || partyInt >= nInt) fail('partyId must be in [1, n)');
}

/** Join code contents as decrypted; numeric fields are unparsed */
interface ParsedJoinCode {
  id: string;
  partyId: string;
  chain: string;
  network: string;
  m: string;
  n: string;
  /** Anything after the ceremony fields (the optional invitation `extra`, used as the server password fallback) */
  extra: string;
  /** Normalized creator public key the code was issued by */
  creatorPubKey: string;
}

/**
 * What an exported session holds beyond the DKG state: the ceremony it belongs to and the trusted keys
 * the delivery of the wallet secret is encrypted to / verified against.
 * It is encrypted to the exporting party's own request key, which also authenticates it.
 */
interface SessionWrapper {
  version: number;
  id: string;
  partyId: number;
  chain: string;
  network: string;
  m: number;
  n: number;
  /** The exporting party's request public key */
  requestPubKey: string;
  /** The legacy export: `id:partyId:m:n:<DKG export>` */
  session: string;
  /** Recipient only: the creator's key from the trusted invitation */
  creatorPubKey?: string;
  /** Creator only: each recipient's key from the trusted invitation exchange */
  recipientKeys: Array<{ partyId: number; pubKey: string }>;
}

/**
 * Trusted inputs for restoring a session that has no retained delivery bindings (a legacy export),
 * or to confirm them for one that has. They must come from the original invitation exchange, never from BWS.
 */
export type RestoreTrustedInputs =
  | {
    /** Creator only: the public key each recipient gave the creator (as passed to `createJoinCode`) */
    recipientKeys: Array<{ partyId: number; partyPubKey: string }>;
    joinCode?: never;
  }
  | {
    /** Recipient only: the join code originally received, with the same options `joinKey` takes */
    joinCode: {
      code: string | Buffer;
      opts?: { encoding?: BufferEncoding; noKey?: boolean };
      creatorPubKey?: string;
    };
    recipientKeys?: never;
  };

/** The trusted keys delivery is encrypted to / verified against */
interface DeliveryBindings {
  /** Recipient only */
  creatorPubKey?: string;
  /** Creator only: partyId -> request public key */
  recipientKeys: Map<number, string>;
}

/**
 * Check retained bindings for well-formed keys that belong to the party's role: a creator retains a key for each
 * recipient (party IDs 1 to n - 1), and a recipient retains only the creator's key.
 * @returns What is wrong, if anything
 */
function bindingsViolation(partyId: number, n: number, bindings: DeliveryBindings): string | undefined {
  const isNormalizedKey = (key: unknown) => {
    try {
      return typeof key === 'string' && key === normalizePubKey(key);
    } catch {
      return false;
    }
  };
  if (partyId === 0) {
    if (bindings.creatorPubKey != null) return 'the creator should not have a creator key';
    for (const [recipient, key] of bindings.recipientKeys) {
      if (recipient < 1 || recipient >= n || !isNormalizedKey(key)) return 'malformed delivery keys';
    }
  } else {
    if (bindings.recipientKeys.size) return 'a recipient has no recipient keys';
    // If the key is present, it must be normalized
    if (bindings.creatorPubKey != null && !isNormalizedKey(bindings.creatorPubKey)) return 'malformed delivery keys';
  }
}

/**
 * Read `n`, `m` and `partyId` from the DKG's own export (`round:n:m:partyId:...`), which is encrypted to the request key.
 * Only the leading fields are parsed so the rest of the plaintext (which includes the seed) never becomes a string.
 */
function readKeygenSessionParams(keygenSession: string, requestPrivKey: BitcoreLib.PrivateKey) {
  const plaintext = TssUtils.decrypt(Buffer.from(keygenSession, 'base64'), requestPrivKey.publicKey, requestPrivKey);
  try {
    let end = -1;
    // advance end to the correct position: the fourth ':'
    for (let i = 0; i < 4; i++) {
      end = plaintext.indexOf(':', end + 1);
      if (end < 0) {
        throw new Error('Invalid session');
      }
    }
    // end is advanced to the correct position so subarray().toString() doesn't create an immutable string containing the seed
    const [, n, m, partyId] = plaintext.subarray(0, end).toString().split(':').map(Number);
    return { n, m, partyId };
  } finally {
    plaintext.fill(0);
  }
}

/**
 * One local participant in one TSS key-generation ceremony. Use a separate instance for each participant and ceremony.
 * Call either newKey() (creator) or joinKey() (recipient) once. After initialization starts, even a failed start requires
 * a fresh instance: BWS may already have accepted it. Session restoration remains available for recovery and rollback.
 */
export class TssKeyGen extends EventEmitter {
  #request: Request;
  #key: Key;
  #xPrivKey: string;
  #keygen: ECDSA.KeyGen;
  #initializationState: 'unused' | 'initializing' | 'in-use' = 'unused';
  #seed: string;
  #credentials: Credentials;
  #requestPrivateKey: BitcoreLib.PrivateKey;
  #subscriptionId: ReturnType<typeof setInterval>;
  #subscriptionRunning: boolean;
  #recipientKeys: Map<number, string> = new Map();
  #creatorPubKey: string;
  #createdWallet?: { wallet: any; secret: string };
  #stopErrors = new WeakSet<object>(); // Errors the subscription must not retry past (see `subscribe`). Weakly held, so recording an error does not keep it alive
  id: string;
  chain: string;
  network: Network;
  m: number;
  n: number;
  partyId: number;
  backupKeyShare: boolean;


  /**
   * Threshold Signature Scheme (TSS) client class
   */
  constructor(
    /** Constructor parameters */
    params: ITssKeyGenConstructorParams,
    /** EventEmitter options object */
    eventOpts?
  ) {
    super(eventOpts);
    $.checkArgument(params.chain, 'Missing required param: chain');
    $.checkArgument(params.network, 'Missing required param: network');
    $.checkArgument(params.baseUrl, 'Missing required param: baseUrl');
    $.checkArgument(params.key, 'Missing required param: key');
    $.checkArgument(params.key instanceof Key, 'key must be an instance of Key');

    this.chain = params.chain.toLowerCase();
    this.network = params.network;
    this.#request = new Request(params.baseUrl, {
      r: params.request, // For testing only
    });

    this.#key = params.key;
    // n is always 1 when creating credentials because the wallet is not multisig (threshold sig !== multisig).
    // In other words, it will look like a single sig wallet on-chain.
    this.#credentials = this.#key.createCredentials(params.password, { chain: this.chain, network: this.network, n: 1, account: 0 });
    this.#request.setCredentials(this.#credentials);
    this.#requestPrivateKey = BitcoreLib.PrivateKey.fromString(this.#credentials.requestPrivKey);

    const baseXPrivKey = this.#key.get(params.password).xPrivKey;
    const derivationPath = this.#credentials.getRootPath();
    this.#xPrivKey = new BitcoreLib.HDPrivateKey(baseXPrivKey).deriveChild(derivationPath).toString();
    const _seed = BitcoreLib.HDPrivateKey.fromString(this.#xPrivKey);
    this.#seed = BitcoreLib.crypto.Hash.sha256(_seed.toBuffer());

    // Backup to server is disabled
    // this.backupKeyShare = !!params.backupKeyShare;
  }

  /**
   * Initiate a new Threshold Signature Scheme key generation session
   * Only valid on an unused instance; cannot be combined with joinKey() on the same instance.
   * @returns {Promise<TssKeyGen>}
   */
  async newKey(params: {
    /**
     * Number of required signatures
     */
    m: number | string;
    /**
     * Number of parties/signers
     */
    n: number | string;
    /**
     * An optional password other parties must provide in order to join the session on the server.
     * This adds a layer of server-side security beyond the client-side-only join code.
     */
    password?: string;
  }): Promise<TssKeyGen> {
    this.#assertUnused();
    const { m, n, password } = params;
    const keygen = new ECDSA.KeyGen({
      n,
      m,
      partyId: 0, // the session initiator is always partyId 0
      seed: this.#seed,
      authKey: this.#credentials.requestPrivKey
    });
    this.#initializationState = 'initializing';
    this.id = BitcoreLib.crypto.Hash.sha256sha256(this.#seed).toString('hex');
    this.m = parseInt(m as string);
    this.n = parseInt(n as string);
    this.partyId = 0;
    this.#createdWallet = undefined;

    try {
      const msg = await keygen.initJoin();
      await this.#request.post('/v1/tss/keygen/' + this.id, { message: msg, n, password, version: TSS_KEYGEN_VERSION });
      this.#keygen = keygen;
      return this;
    } finally {
      this.#initializationState = 'in-use';
    }
  }

  #assertUnused(): void {
    $.checkState(this.#initializationState === 'unused', 'TssKeyGen initialization already started. Use a new instance for each participant and ceremony.');
  }

  /**
   * Get the public key used for authentication. Each joining party will need
   * to provide this to the session initiator in order to join the TSS key.
   * @returns {string} The public key used for session authentication
   */
  getAuthPublicKey(): string {
    return this.#credentials.requestPubKey;
  }

  /**
   * Create a join code for a party to join the TSS key.
   * The join code is encrypted with the party's public key and is thus party-specific.
   * Note that the join code is verified on the client side only. Someone could theoretically
   *  intercept or brute force the session ID and submit an initial message to join the session
   *  uninvited. To prevent this (unlikely) possibility, set a password in the newKey() method
   *  and share it with the other parties.
   * @returns {Promise<string>} Encrypted join code
   */
  async createJoinCode(params: {
    /**
     * Party ID to create the join code for
     */
    partyId: number;
    /**
     * Public key of the party to encrypt the join code to
     */
    partyPubKey: string;
    /**
     * Extra data to include in the join code
     */
    extra?: string;
    /**
     * Options for the join code. Also contains opts for the ECIES.encrypt method
     */
    opts?: {
      /**
       * Encoding for the join code (default: 'hex')
       */
      encoding?: BufferEncoding;
      /**
       * ECIES.encrypt: Don't include the public key in the result
       */
      noKey?: boolean;
    };
  }): Promise<string> {
    const { partyId, partyPubKey, opts } = params;
    $.checkArgument(Number.isInteger(partyId) && partyId > 0 && partyId < this.n, 'partyId must be an integer between 1 and n - 1');
    const normalizedPubKey = normalizePubKey(partyPubKey, 'partyPubKey');
    const extra = params.extra || '';
    await this.#request.post('/v1/tss/keygen/' + this.id + '/register', { partyId, partyPubKey: normalizedPubKey });
    const data = [this.id, partyId, this.chain, this.network, this.m, this.n, extra].join(':');
    const code = ECIES.encrypt({
      message: data,
      publicKey: normalizedPubKey,
      privateKey: this.#requestPrivateKey,
      opts
    });
    // Only retain the assignment once the invitation was successfully produced.
    // Reissuing for the same party replaces its key (e.g. the creator corrected a mistyped key before delivery).
    this.#recipientKeys.set(partyId, normalizedPubKey);
    return code.toString(opts?.encoding || 'hex');
  }

  checkJoinCode(params: {
    code: string | Buffer;
    opts?: {
      /**
       * Encoding for the join code (default: 'hex')
       */
      encoding?: BufferEncoding;
      /**
       * The join code was created with the `noKey` option. Requires `creatorPubKey`.
       */
      noKey?: boolean;
    };
    /**
     * The session creator's public key (the creator's `getAuthPublicKey()`), obtained from a trusted exchange.
     * Required if the join code was created with `noKey`; otherwise, if given, the join code must have been issued by this key.
     */
    creatorPubKey?: string;
  }) {
    const { id, partyId, chain, network, m, n } = this.#readJoinCode(params);
    return {
      id,
      partyId: parseInt(partyId),
      chain,
      network,
      m: parseInt(m),
      n: parseInt(n),
    };
  }

  /**
   * Join a Threshold Signature Scheme key
   */
  async joinKey(params: {
    /**
     * Join code given by the session initiator
     */
    code: string | Buffer;
    /**
     * Options for the join code. Also contains opts for the ECIES.decrypt method
     */
    opts?: {
      /**
       * Encoding for the join code (default: 'hex')
       */
      encoding?: BufferEncoding;
      /**
       * The join code was created with the `noKey` option. Requires `creatorPubKey`.
       */
      noKey?: boolean;
    };
    /**
     * Server password to join the TSS key. This was set by the initiator and should be told to you by them.
     */
    password?: string;
    /**
     * The session creator's public key (the creator's `getAuthPublicKey()`), obtained from a trusted exchange.
     * Required if the join code was created with `noKey`; otherwise, if given, the join code must have been issued by this key.
     * The creator key from the join code becomes the trusted key for later delivery verification.
     */
    creatorPubKey?: string;
  }): Promise<TssKeyGen> {
    this.#assertUnused();
    let { password } = params;
    const { id, partyId, chain, network, m, n, extra, creatorPubKey } = this.#readJoinCode(params);
    const authKey = this.#credentials.requestPrivKey;

    const keygen = new ECDSA.KeyGen({
      m,
      n,
      partyId,
      seed: this.#seed,
      authKey
    });

    this.#initializationState = 'initializing';
    this.#keygen = keygen;
    this.id = id;
    this.chain = chain;
    this.network = network as Network;
    this.m = parseInt(m);
    this.n = parseInt(n);
    this.partyId = parseInt(partyId);
    this.#creatorPubKey = creatorPubKey;
    this.#recipientKeys.clear();
    this.#createdWallet = undefined;

    try {
      const msg = await keygen.initJoin();
      password = password || extra;
      await this.#request.post('/v1/tss/keygen/' + this.id, { message: msg, password, version: TSS_KEYGEN_VERSION });
      return this;
    } finally {
      this.#initializationState = 'in-use';
    }
  }

  /**
   * Decrypt a join code and identify the creator key it was issued by.
   * Does not retain anything; callers decide whether the result becomes trusted state.
   */
  #readJoinCode(params: {
    code: string | Buffer;
    opts?: { encoding?: BufferEncoding; noKey?: boolean };
    creatorPubKey?: string;
  }): ParsedJoinCode {
    let { code } = params;
    const { opts, creatorPubKey } = params;
    $.checkArgument(code, 'Missing required param: code');
    $.checkArgument(typeof code === 'string' || Buffer.isBuffer(code), '`code` must be a string or buffer');
    code = Buffer.isBuffer(code) ? code : Buffer.from(code, opts?.encoding || 'hex');

    const expectedCreatorKey = creatorPubKey == null ? undefined : normalizePubKey(creatorPubKey, 'creatorPubKey');

    const authKey = this.#credentials.requestPrivKey;
    let senderKey: string;
    let decrypted: Buffer | undefined;
    try {
      if (opts?.noKey) {
      // A noKey code carries no sender key, so the caller must supply the creator's key from a trusted exchange.
        if (!expectedCreatorKey) {
          throw new Error('creatorPubKey is required for a join code created with noKey');
        }
        senderKey = expectedCreatorKey;
        decrypted = ECIES.decrypt({ payload: code, privateKey: authKey, publicKey: senderKey });
      } else {
        senderKey = normalizePubKey(ECIES.readSenderPublicKey(code));
        decrypted = ECIES.decrypt({ payload: code, privateKey: authKey });
      }

      if (expectedCreatorKey && senderKey !== expectedCreatorKey) {
        throw new Error('Join code was not issued by the expected creator key');
      }

      // Parsing needs strings, which cannot be wiped. The decrypted buffer is zeroed below.
      const [id, partyId, chain, network, m, n, ...more] = (decrypted as Buffer).toString().split(':');
      assertValidJoinCode({ id, partyId, chain, network, m, n });
      return { id, partyId, chain, network, m, n, extra: more.join(':'), creatorPubKey: senderKey };
    } finally {
      decrypted?.fill(0);
    }
  }

  /**
   * Check the locally retained delivery keys against the session's party/request-key mapping from BWS.
   * The retained keys are the source of trust: BWS data is only compared against them, never adopted.
   * Throws if a retained key is missing or the session disagrees with it.
   * @param sessionKeys The request public key each party enrolled in the session with, indexed by partyId
   *   (the `publicKey` of each party's round-0 message at BWS)
   */
  verifyDeliveryBindings(sessionKeys: Array<string>): void {
    $.checkArgument(Array.isArray(sessionKeys), 'sessionKeys must be an array');
    const sessionKey = (partyId: number) => {
      const key = sessionKeys[partyId];
      if (!key) {
        throw new Error(`Session has no public key for party ${partyId}`);
      }
      try {
        return normalizePubKey(key);
      } catch {
        throw new Error(`Session has an invalid public key for party ${partyId}`);
      }
    };
    const expectKey = (partyId: number, trusted: string) => {
      if (sessionKey(partyId) !== trusted) {
        throw new Error(`Session public key for party ${partyId} does not match the trusted key`);
      }
    };

    if (this.partyId === 0) {
      for (let partyId = 1; partyId < this.n; partyId++) {
        const trusted = this.#recipientKeys.get(partyId);
        if (!trusted) {
          throw new Error(`Missing trusted public key for party ${partyId}. Create a join code for this party first.`);
        }
        expectKey(partyId, trusted);
      }
    } else {
      if (!this.#creatorPubKey) {
        throw new Error('Missing trusted creator public key. Join using the creator\'s join code.');
      }
      expectKey(0, this.#creatorPubKey);
    }
    // Every party must be registered under its own request key
    expectKey(this.partyId, normalizePubKey(this.#credentials.requestPubKey));
  }

  /**
   * Export the session for storage.
   * Besides the DKG state, the export carries the delivery keys retained from the invitation exchange,
   * so a restored session can still deliver/verify the wallet secret. It is encrypted to this party's request key.
   * @returns {string} Session string
   */
  exportSession(): string {
    if (this.#keygen.isKeyChainReady()) {
      throw new Error('Cannot export a completed session. Run getKeyChain() instead.');
    }
    const wrapper: SessionWrapper = {
      version: SESSION_WRAPPER_VERSION,
      id: this.id,
      partyId: this.partyId,
      chain: this.chain,
      network: this.network,
      m: this.m,
      n: this.n,
      requestPubKey: normalizePubKey(this.#credentials.requestPubKey),
      session: [this.id, this.partyId, this.m, this.n, this.#keygen.export()].join(':'),
      recipientKeys: [...this.#recipientKeys].map(([partyId, pubKey]) => ({ partyId, pubKey }))
    };
    if (this.#creatorPubKey) {
      wrapper.creatorPubKey = this.#creatorPubKey;
    }
    const plaintext = Buffer.from(JSON.stringify(wrapper));
    try {
      const encrypted = TssUtils.encrypt(plaintext, this.#requestPrivateKey.publicKey, this.#requestPrivateKey);
      return SESSION_WRAPPER_PREFIX + encrypted.toString('base64');
    } finally {
      plaintext.fill(0);
    }
  }

  /**
   * Restore a session from a previously exported session
   *
   * A session exported before delivery keys were retained (a legacy export) carries none.
   * Supply them from the original invitation exchange with `trusted`; otherwise delivery reports missing trust.
   * They are never reconstructed from BWS.
   * @returns {Promise<TssKeyGen>} Restored TSS instance
   */
  async restoreSession(params: {
    /**
     * Session string to restore
     */
    session: string;
    /**
     * Original trusted invitation inputs. Required to establish delivery trust for a legacy export.
     * For an export that retained its keys, they must agree with what was retained.
     */
    trusted?: RestoreTrustedInputs;
  }): Promise<TssKeyGen> {
    $.checkState(this.#initializationState !== 'initializing', 'TssKeyGen initialization is in progress. Wait for it to finish before restoring a session.');
    const { session, trusted } = params;
    // Everything is validated before any state is replaced, so a failed restore changes nothing.
    const { restored, keygenSession, retained } = this.#readSession(session);
    const bindings = this.#applyTrustedInputs(trusted, restored, retained);

    const previousState = this.#initializationState;
    this.#initializationState = 'initializing';
    try {
      const keygen = await ECDSA.KeyGen.restore({ session: keygenSession, authKey: this.#credentials.requestPrivKey });
      this.id = restored.id;
      this.m = restored.m;
      this.n = restored.n;
      this.partyId = restored.partyId;
      this.#keygen = keygen;
      this.#creatorPubKey = bindings.creatorPubKey;
      this.#recipientKeys = bindings.recipientKeys;
      this.#createdWallet = undefined;
    } catch (err) {
      this.#initializationState = previousState;
      throw err;
    }
    this.#initializationState = 'in-use';
    return this;
  }

  /**
   * Parse either session format. Does not retain anything.
   * `retained` is what the session string itself vouches for: the keys from a wrapper, and always nothing for a legacy export.
   */
  #readSession(session: string): {
    restored: { id: string; partyId: number; m: number; n: number };
    keygenSession: string;
    retained: DeliveryBindings;
  } {
    const isWrapped = session.startsWith(SESSION_WRAPPER_PREFIX);
    const retained: DeliveryBindings = { recipientKeys: new Map() };
    // legacy, reassigned if isWrapped
    let unwrappedSession = session;

    if (isWrapped) {
      const wrapper = this.#readSessionWrapper(session.slice(SESSION_WRAPPER_PREFIX.length));
      unwrappedSession = wrapper.session;
      retained.creatorPubKey = wrapper.creatorPubKey;
      for (const { partyId, pubKey } of wrapper.recipientKeys) {
        retained.recipientKeys.set(partyId, pubKey);
      }
      const violation = bindingsViolation(wrapper.partyId, wrapper.n, retained);
      if (violation) {
        throw new Error('Invalid session: ' + violation);
      }
    }

    const parts = unwrappedSession.split(':');
    const id = parts.slice(0, -4).join(':'); // id may contain colons, so we join all parts except the last 4
    const [partyId, m, n, keygenSession] = parts.slice(-4);
    const restored = { id, partyId: parseInt(partyId), m: parseInt(m), n: parseInt(n) };

    // Check both formats against the authenticated DKG state; legacy outer parameters are plaintext.
    let dkg: ReturnType<typeof readKeygenSessionParams>;
    try {
      dkg = readKeygenSessionParams(keygenSession, this.#requestPrivateKey);
    } catch {
      throw new Error('Session could not be decrypted or verified');
    }
    if (dkg.n !== restored.n || dkg.m !== restored.m || dkg.partyId !== restored.partyId) {
      throw new Error('Session ceremony parameters do not match its DKG state');
    }
    return { restored, keygenSession, retained };
  }

  /**
   * Decrypt and validate a session wrapper against this instance's request identity and chain/network.
   * Does not retain anything.
   */
  #readSessionWrapper(encoded: string): SessionWrapper {
    let wrapper: SessionWrapper;
    try {
      const plaintext = TssUtils.decrypt(Buffer.from(encoded, 'base64'), this.#requestPrivateKey.publicKey, this.#requestPrivateKey);
      try {
        wrapper = JSON.parse(plaintext.toString());
      } finally {
        plaintext.fill(0);
      }
    } catch {
      throw new Error('Session could not be decrypted or verified');
    }

    const fail = (reason: string): never => { throw new Error('Invalid session: ' + reason); };
    const isInt = (v: unknown): v is number => Number.isSafeInteger(v);
    if (!wrapper || typeof wrapper !== 'object') fail('malformed');
    if (wrapper.version !== SESSION_WRAPPER_VERSION) fail('unsupported version');
    if (typeof wrapper.id !== 'string' || !wrapper.id) fail('missing session id');
    if (!isInt(wrapper.m) || !isInt(wrapper.n) || !isInt(wrapper.partyId)) fail('malformed ceremony parameters');
    if (wrapper.m < 1 || wrapper.m > wrapper.n || wrapper.partyId < 0 || wrapper.partyId >= wrapper.n) fail('ceremony parameters out of range');
    if (typeof wrapper.session !== 'string') fail('missing DKG state');
    if (wrapper.requestPubKey !== normalizePubKey(this.#credentials.requestPubKey)) fail('exported by a different request key');
    if (wrapper.chain !== this.chain || wrapper.network !== this.network) fail('chain or network does not match');
    if (!Array.isArray(wrapper.recipientKeys)) fail('malformed delivery keys');

    // The wrapper's own fields must describe the DKG export it wraps
    const parts = wrapper.session.split(':');
    const sessionId = parts.slice(0, -4).join(':');
    const [partyId, m, n] = parts.slice(-4).map(Number);
    if (sessionId !== wrapper.id || partyId !== wrapper.partyId || m !== wrapper.m || n !== wrapper.n) {
      fail('ceremony parameters do not match the wrapped session');
    }

    // Entry shape only. Whether the keys are valid and fit the role is checked by bindingsViolation().
    const seen = new Set<number>();
    for (const entry of wrapper.recipientKeys) {
      if (!entry || typeof entry !== 'object' || !isInt(entry.partyId) || seen.has(entry.partyId)) {
        fail('malformed delivery keys');
      }
      seen.add(entry.partyId);
    }
    return wrapper;
  }

  /**
   * Merge caller-supplied trusted inputs into the retained bindings.
   * Inputs that contradict a retained binding are rejected rather than replacing it.
   * @returns The bindings to keep
   */
  #applyTrustedInputs(
    trusted: RestoreTrustedInputs | undefined,
    restored: { id: string; partyId: number; m: number; n: number },
    retained: DeliveryBindings
  ): DeliveryBindings {
    const bindings: DeliveryBindings = { creatorPubKey: retained.creatorPubKey, recipientKeys: new Map(retained.recipientKeys) };
    if (!trusted) return bindings;
    const { recipientKeys: suppliedRecipients, joinCode } = trusted;

    /**
     * NAND(suppliedRecipients, joinCode)
     */
    if (suppliedRecipients) {
      $.checkArgument(restored.partyId === 0, 'Recipient keys can only be supplied when restoring the creator\'s session');
      $.checkArgument(Array.isArray(suppliedRecipients), 'recipientKeys must be an array');
      for (const { partyId, partyPubKey } of suppliedRecipients) {
        $.checkArgument(Number.isInteger(partyId) && partyId > 0 && partyId < restored.n, 'partyId must be an integer between 1 and n - 1');
        const key = normalizePubKey(partyPubKey, 'partyPubKey');
        const existing = bindings.recipientKeys.get(partyId);
        if (existing && existing !== key) {
          throw new Error(`Supplied public key for party ${partyId} does not match the retained key`);
        }
        bindings.recipientKeys.set(partyId, key);
      }
    }

    if (joinCode) {
      $.checkArgument(restored.partyId > 0, 'A join code can only be supplied when restoring a recipient\'s session');
      const code = this.#readJoinCode(joinCode);
      if (code.id !== restored.id || parseInt(code.partyId) !== restored.partyId ||
        parseInt(code.m) !== restored.m || parseInt(code.n) !== restored.n ||
        code.chain.toLowerCase() !== this.chain || code.network !== this.network) {
        throw new Error('Join code does not match the session being restored');
      }
      if (bindings.creatorPubKey && bindings.creatorPubKey !== code.creatorPubKey) {
        throw new Error('Join code creator key does not match the retained key');
      }
      bindings.creatorPubKey = code.creatorPubKey;
    }
    return bindings;
  }

  /**
   * Subscribe to the TSS key generation process + wallet creation
   * Various events will be emitted during the process:
   * - `roundready` => number: A new round is ready to be processed. Emits the round number.
   * - `roundprocessed` => number: A round has been processed. Emits the round number.
   * - `roundsubmitted` => number: A round has been submitted to the server. Emits the round number.
   * - `tsskey` => TssKey: The TSS key is ready. Emits the key class object.
   * - `tsskeystored`: => void: The TSS pub key and keyshare backup has been stored on the server.
   * - `wallet` => any: The wallet has been created. Emits the wallet object.
   * - `complete` => void: The key generation process (+ wallet creation, if applicable) is complete. This is the final event emitted along the happy path.
   * - `error` => Error: An error occurred during the process. Emits the error. Note that this will not stop the subscription,
   *   unless the wallet phase cannot be retried: creating the wallet or delivering its secret (party 0), or receiving it and
   *   joining (other parties). E.g. missing/conflicting trusted keys, a delivery that fails decryption or verification,
   *   or an ambiguous wallet creation/join failure. The subscription then stops, emitting `unsubscribe` after the error.
   * @returns {NodeJS.Timeout} Subscription ID
   */
  subscribe(params: {
    /**
     * Timeout in milliseconds for the subscription to check for new messages (default: 1000)
     * @default 1000
     */
    timeout?: number;
    /**
     * Custom function to fire every iteration. Does not fire on error.
     */
    iterHandler?: () => void;
    /**
     * Name of the wallet to create.
     * Only provied by party 0 (the session initiator).
     */
    walletName?: string;
    /**
     * Name of the party/copayer. This is used to identify the party in the wallet (e.g. "Evan", "Sara Smith", etc.).
     * If given, the wallet will be automatically created/joined at BWS after the key generation is complete.
     * Omit if you wish to only generate the TSS key and not create the wallet.
     */
    copayerName?: string;
    /**
     * Options to pass to createWallet() when the key generation is complete.
     * Only provided by party 0 (the session initiator).
     */
    createWalletOpts?: CreateWalletOpts;
  } = {}): NodeJS.Timeout {
    const { timeout, iterHandler, walletName, copayerName, createWalletOpts } = params;
    $.checkArgument(
      this.partyId > 0 || 
      (this.partyId === 0 &&
        // (party0 only) walletName and copayerName must be supplied together or not at all
        ((walletName == null && copayerName == null) || 
        (walletName && copayerName))
      ),
      'Both the walletName and copayerName must be provided if you wish to create the wallet in subscribe().'
    );

    const complete = () => {
      this.emit('complete');
      if (iterHandler) iterHandler();
      this.unsubscribe();
      // Anything after unsubscribe() will not be executed
    };

    // Whether the server is known to hold the shared public key: either a round poll showed it, or this party stored it.
    // Until then each tick polls a round, since that is where the server reports the key. After, it need not.
    let keyStored = false;

    this.#subscriptionId = setInterval(async () => {
      if (this.#subscriptionRunning) return;
      this.#subscriptionRunning = true;
      const thisRound = this.#keygen.getRound();
      // Once the DKG is complete there are no more rounds. Polling one is only needed to learn whether the shared public
      //  key is stored; after that the wallet phase below repeats on its own, without depending on round requests
      //  (which must also never export a completed session or advance the DKG again).
      let body: { messages?: Array<any>; publicKey?: string } = {};
      try {
        if (!this.#keygen.isKeyChainReady() || !keyStored) {
          const prevRound = thisRound - 1; // Get previous round's messages
          ({ body } = await this.#request.get(`/v1/tss/keygen/${this.id}/${prevRound}`) as RequestResponse);
          // false to true the first time publicKey is found - shouldn't be toggled off again
          keyStored ||= !!body.publicKey;
        }

        // Once complete there is no round left to process, whatever the poll returned
        const hasEveryoneSubmitted = !this.#keygen.isKeyChainReady() && body.messages?.length === this.n - 1; // subtract yourself
        if (hasEveryoneSubmitted) {
          this.emit('roundready', thisRound);
          // Snapshot the session in case there's an API failure
          //  since this.#keygen can't re-process the messages
          const sessionBak = this.exportSession();
          try {
            const msg = await this.#keygen.nextRound(body.messages);
            this.emit('roundprocessed', thisRound);
            // If the keychain is ready, there's nothing to send to the server and msg will have empty arrays.
            if (!this.#keygen.isKeyChainReady()) {
              // For 2 P2P messages (i.e. party of 3), it already exceeds 100 KB (190 KB)
              // Assuming ~80KB per message, the max server size of 2MB would be ~25 P2P messages
              await this.#request.post(`/v1/tss/keygen/${this.id}`, { message: msg, version: TSS_KEYGEN_VERSION });
              this.emit('roundsubmitted', thisRound);
            }
          } catch (err) {
            // Restore the session to the previous state
            await this.restoreSession({ session: sessionBak });
            throw err;
          }
        }

        const key = this.getTssKey();
        if (key) {
          this.emit('tsskey', key);
          
          // Backup to server is disabled
          if (!keyStored) {// || (!body.hasKeyBackup && this.backupKeyShare)) {
            // const encryptedKeyChain = ECIES.encrypt({
            //   message: key.keychain.privateKeyShare.toString('base64') + ':' + key.keychain.reducedPrivateKeyShare.toString('base64'),
            //   publicKey: new BitcoreLib.HDPrivateKey(this.#xPrivKey).publicKey,
            //   privateKey: new BitcoreLib.HDPrivateKey(this.#xPrivKey).privateKey,
            //   opts: { noKey: true }
            // }).toString('base64');
            // await this.#request.post(`/v1/tss/keygen/${this.id}/store`, { publicKey: key.keychain.commonKeyChain, encryptedKeyChain });
            await this.#request.post(`/v1/tss/keygen/${this.id}/store`, { publicKey: key.keychain.commonKeyChain });
            this.emit('tsskeystored');
            keyStored = true;
          }

          if (!copayerName) {
            complete();
            // Anything after complete()/unsubscribe() will not be executed
          } else {
            let wallet;
            if (this.partyId === 0) {
              wallet = await this.createWallet({
                walletName,
                copayerName,
                opts: createWalletOpts
              });
            } else if (this.partyId > 0) {
              try {
                wallet = await this.joinWallet({ copayerName });
              } catch (err) {
                if (!(err instanceof Errors.TSS_JOIN_DELIVERY_PENDING)) {
                  throw err;
                }
                // Ignore a pending delivery since it means the session initiator has not finished creating the wallet yet
              }
            }
          
            if (wallet) {
              this.emit('wallet', wallet);
              complete();
              // Anything after complete()/unsubscribe() will not be executed
            }
          }
        }
        // iteration handler
        // Some custom function to fire every iteration
        if (iterHandler) iterHandler();
      } catch (err) {
        try {
          this.emit('error', err);
        } finally {
          // A failure that repeating cannot fix would only repeat itself (or, for wallet creation, repeat the enrollment).
          // Once the DKG is complete, a rejected or expired session is such a failure. Before that, it is left to the consumer.
          if (this.#stopErrors.has(err) || (this.#keygen.isKeyChainReady() && (err instanceof Errors.NOT_AUTHORIZED || err instanceof Errors.TSS_SESSION_EXPIRED))) {
            this.unsubscribe({ clearEvents: false });
          }
        }
      } finally {
        this.#subscriptionRunning = false;
      }
    }, timeout || 1000);

    return this.#subscriptionId;
  }

  /**
   * Unsubscribe from the TSS key generation process
   * Calling this method will emit the 'unsubscribe' event.
   */
  unsubscribe(params: {
    /**
     * Whether to remove all event listeners
     * @default true
     */
    clearEvents: boolean;
  } = { clearEvents: true }): void {
    const { clearEvents } = params;
    clearInterval(this.#subscriptionId);
    if (clearEvents) {
      this.removeAllListeners();
    }
    this.#subscriptionId = null;
    this.#subscriptionRunning = false;
    this.emit('unsubscribe');
  }

  /**
   * Get the key object if the key generation process is complete
   * @returns {TssKey|null} The keychain object if the key generation process is complete, otherwise null
   */
  getTssKey(password?: PasswordMaybe): TssKey | null {
    if (this.#keygen.isKeyChainReady()) {
      const keychain = this.#keygen.getKeyChain();
      const key = new TssKey({
        ...this.#key.toObj(),
        keychain: { ...keychain },
        metadata: {
          id: this.id,
          m: this.m,
          n: this.n,
          partyId: this.partyId
        }
      });
      if (password) {
        key.encrypt(password);
      }
      return key;
    }
    return null;
  }

  /**
   * Create the wallet and publish its join secret, encrypted to each other party, to BWS.
   * Only the session creator (party 0) can do this, after the DKG is complete.
   *
   * If publishing fails, calling this again publishes the same wallet's secret again; it does not create another wallet.
   * That only holds within this instance: the created wallet is not persisted.
   */
  async createWallet(params: {
    walletName: string;
    copayerName: string;
    opts?: CreateWalletOpts & { addressType?: string };
  }) {
    const { walletName, copayerName, opts = {} } = params;
    const key = this.getTssKey();
    if (!key) {
      throw new Error('TSS Key generation is not complete. This should be called after the `complete` event is emitted.');
    }
    $.checkState(this.partyId === 0, 'Only the session creator can create the wallet');

    // Checked before creating anything, since a wallet whose secret cannot be delivered would be left behind,
    // and again on every retry: createJoinCode() can replace a retained key in between.
    // Delivery is encrypted only to the keys that passed this check.
    let recipientKeys: Map<number, string>;
    try {
      recipientKeys = await this.#checkSessionKeys();
    } catch (err) {
      throw isRetryableDeliveryRequestError(err) ? err : this.#stopOn(err);
    }

    if (!this.#createdWallet) {
      this.#credentials.clientDerivedPublicKey = key.getXPubKey(this.network);

      // Same transport as this instance's own requests (the default one, unless a test supplied another)
      const client = new Client({ baseUrl: this.#request.baseUrl, request: this.#request.r });
      client.fromObj(this.#credentials.toObj());

      try {
        const created = await client.createWallet(
          walletName,
          copayerName,
          key.metadata.m,
          key.metadata.n,
          Object.assign({}, opts, {
            tssKeyId: this.id,
            chain: this.chain,
            network: this.network,
          })
        );

        if (!created?.wallet) {
          throw new Error('Wallet creation returned no wallet');
        }

        const credObj = client.toObj();
        this.#credentials.addWalletInfo(credObj.walletId, walletName, 1, 1, copayerName, {
          useNativeSegwit: ['P2WPKH', 'P2WSH', 'P2TR'].includes(created.wallet.addressType),
          segwitVersion: created.wallet.addressType === 'P2TR' ? 1 : 0,
          tssKeyId: this.id,
        });
        this.#createdWallet = created;
      } catch (err) {
        // The wallet may or may not exist at BWS by now, and may not be recorded here, so a failure anywhere
        // from the request to recording the result must not be retried as another creation
        throw this.#stopOn(err);
      }
    }

    const { wallet, secret } = this.#createdWallet;
    await this.#publishJoinDelivery(secret, key.keychain.commonKeyChain, recipientKeys);
    return wallet;
  }

  /**
   * Record that the subscription must stop on this error, and return it.
   * Used directly where even a transient-looking failure must stop: a lost response to the wallet creation request
   * does not say whether the wallet was created, so repeating it could create another.
   * Anything that is not an object cannot be recorded (a WeakSet rejects it), and must not replace the error being thrown.
   */
  #stopOn<T>(err: T): T {
    if (err && typeof err === 'object') {
      this.#stopErrors.add(err);
    }
    return err;
  }

  /**
   * Check the retained recipient keys against the request key each party enrolled in the session with at BWS.
   * The keys BWS reports are only compared against the retained ones, never used.
   * @returns The retained recipient keys as they were when checked
   */
  async #checkSessionKeys(): Promise<Map<number, string>> {
    // Round 0 holds each party's enrollment message, which carries its request key. BWS leaves out the caller's own.
    const { body } = await this.#request.get(`/v1/tss/keygen/${this.id}/0`) as RequestResponse;
    const sessionKeys: Array<string> = [];
    for (const message of body.messages || []) {
      sessionKeys[message.partyId] = message.publicKey;
    }
    sessionKeys[this.partyId] = this.#credentials.requestPubKey;
    this.verifyDeliveryBindings(sessionKeys);
    // Taken in the same tick as the check, so later changes to the retained keys cannot slip in
    return new Map(this.#recipientKeys);
  }

  /**
   * Encrypt the join secret to each recipient's retained key and replace the published set at BWS.
   * The ciphertext is rebuilt (with fresh randomness) on every call. There is no fallback to plaintext delivery.
   */
  async #publishJoinDelivery(secret: string, commonKeyChain: string, recipientKeys: Map<number, string>) {
    const records: Array<{ partyId: number; encryptedMessage: string; signature: string }> = [];
    try {
      for (let partyId = 1; partyId < this.n; partyId++) {
        const requestPubKey = recipientKeys.get(partyId);
        if (!requestPubKey) {
          throw new Error(`Missing trusted public key for party ${partyId}. Create a join code for this party first.`);
        }
        const { encryptedMessage, signature } = encryptJoinDelivery({
          context: {
            sessionId: this.id,
            partyId,
            requestPubKey,
            chain: this.chain,
            network: this.network,
            m: this.m,
            n: this.n,
            commonKeyChain
          },
          secret,
          creatorPrivKey: this.#requestPrivateKey
        });
        records.push({ partyId, encryptedMessage, signature });
      }
    } catch (err) {
      throw this.#stopOn(err);
    }

    try {
      await this.#request.post(`/v1/tss/keygen/${this.id}/join-delivery`, { version: JOIN_DELIVERY_VERSION, records });
    } catch (err) {
      throw isRetryableDeliveryRequestError(err) ? err : this.#stopOn(err);
    }
  }

  /**
   * Join the wallet the session creator created, using the join secret the creator delivered (encrypted) through BWS.
   * The secret is decrypted and checked here against the invitation and the local DKG result before anything is joined.
   *
   * Throws `TSS_JOIN_DELIVERY_PENDING` if the creator has not published it yet; calling this again later is safe.
   * Joining itself is not repeated by the subscription: a failure of the join request does not say whether it was applied.
   */
  async joinWallet(params: {
    copayerName: string;
    opts?: {
      coin?: string;
      dryRun?: boolean;
    };
  }) {
    const { copayerName, opts = {} } = params;
    const key = this.getTssKey();
    if (!key) {
      throw new Error('TSS Key generation is not complete. This should be called after the `complete` event is emitted.');
    }
    $.checkState(this.partyId > 0, 'The session creator creates the wallet, it does not join it');
    this.#credentials.clientDerivedPublicKey = key.getXPubKey(this.network);

    const secret = await this.#getJoinSecret(key.keychain.commonKeyChain);

    try {
      // Same transport as this instance's own requests (the default one, unless a test supplied another)
      const client = new Client({ baseUrl: this.#request.baseUrl, request: this.#request.r });
      client.fromObj(this.#credentials.toObj());

      const wallet = await client.joinWallet(
        secret,
        copayerName,
        Object.assign({}, opts, {
          chain: this.chain
        })
      );

      const credObj = client.toObj();
      this.#credentials.addWalletInfo(credObj.walletId, credObj.walletName, 1, 1, copayerName, {
        useNativeSegwit: ['P2WPKH', 'P2WSH', 'P2TR'].includes(wallet.addressType),
        segwitVersion: wallet.addressType === 'P2TR' ? 1 : 0,
        tssKeyId: this.id,
      });

      return wallet;
    } catch (err) {
      // The join may or may not have been applied at BWS, so it must not be repeated as another attempt
      throw this.#stopOn(err);
    }
  }

  /**
   * Fetch this party's delivery from BWS, then decrypt it and check it against what is known locally.
   * The creator's key is the one retained from the trusted invitation; nothing BWS returns can replace it.
   * A pending delivery and a transient transport failure are left as they are, since asking again can succeed.
   * Everything else would only repeat itself, so it stops the subscription. There is no fallback to plaintext delivery.
   */
  async #getJoinSecret(commonKeyChain: string): Promise<string> {
    const creatorPubKey = this.#creatorPubKey;
    if (!creatorPubKey) {
      throw this.#stopOn(new Error('Missing trusted creator public key. Join with the join code (or restore the session with it) to verify the delivery.'));
    }

    let delivery: RequestResponse['body'];
    try {
      ({ body: delivery } = await this.#request.get(`/v1/tss/keygen/${this.id}/join-delivery`) as RequestResponse);
    } catch (err) {
      throw (err instanceof Errors.TSS_JOIN_DELIVERY_PENDING || isRetryableDeliveryRequestError(err)) ? err : this.#stopOn(err);
    }

    try {
      if (delivery?.version !== JOIN_DELIVERY_VERSION) {
        throw new Error('Unsupported join delivery version');
      }
      return decryptJoinDelivery({
        delivery,
        recipientPrivKey: this.#requestPrivateKey,
        creatorPubKey,
        expected: {
          sessionId: this.id,
          partyId: this.partyId,
          requestPubKey: this.#credentials.requestPubKey,
          chain: this.chain,
          network: this.network,
          m: this.m,
          n: this.n,
          commonKeyChain
        }
      });
    } catch (err) {
      throw this.#stopOn(err);
    }
  }

  /**
   * Clean up sensitive data from memory.
   * Call this when you are done with the keygen session
   */
  cleanup() {
    this.#createdWallet = undefined;
    this.#keygen?.cleanup();
  }
}
