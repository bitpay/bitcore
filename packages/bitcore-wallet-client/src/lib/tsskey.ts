import { EventEmitter } from 'events';
import { ECDSA, ECIES } from '@bitpay-labs/bitcore-tss';
import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { API as Client, CreateWalletOpts } from './api';
import { Constants, Encryption } from './common';
import { Credentials } from './credentials';
import { ExportedKey, Key, KeyAlgorithm, PasswordMaybe } from './key';
import { Request, RequestResponse } from './request';
import { normalizePubKey } from './tssdelivery';

const $ = BitcoreLib.util.preconditions;

const { TSS_KEYGEN_VERSION } = Constants;

export interface ITssKeyGenConstructorParams {
  /**
   * Chain this key is for (e.g. 'btc', 'bch', 'eth')
   */
  chain: string;
  /**
   * Network this key is for (e.g. 'livenet', 'testnet', 'regtest')
   */
  network: 'livenet' | 'testnet' | 'regtest';
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
 * Read the sender public key from the header of an ECIES payload that was not created with `noKey`.
 * This mirrors the header parsing in ECIES.decrypt and must only be used after a successful decrypt.
 */
function readEciesSenderPubKey(payload: Buffer): string {
  const len = payload[0] === 4 ? 65 : (payload[0] === 2 || payload[0] === 3) ? 33 : 0;
  if (!len) {
    throw new Error('Invalid join code: unrecognized key header');
  }
  return normalizePubKey(BitcoreLib.PublicKey.fromDER(payload.subarray(0, len)));
}

const VALID_NETWORKS = ['livenet', 'testnet', 'regtest'];

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
  if (!VALID_NETWORKS.includes(network as string)) fail('unknown network');
  const mInt = toInt('m', m);
  const nInt = toInt('n', n);
  const partyInt = toInt('partyId', partyId);
  if (mInt < 1 || mInt > nInt) fail('m must be between 1 and n');
  if (partyInt < 1 || partyInt >= nInt) fail('partyId must be between 1 and n - 1');
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

export class TssKeyGen extends EventEmitter {
  #request: Request;
  #key: Key;
  #xPrivKey: string;
  #keygen: ECDSA.KeyGen;
  #seed: string;
  #credentials: Credentials;
  #requestPrivateKey: BitcoreLib.PrivateKey;
  #subscriptionId: ReturnType<typeof setInterval>;
  #subscriptionRunning: boolean;
  #recipientKeys: Map<number, string> = new Map();
  #creatorPubKey: string;
  id: string;
  chain: string;
  network: 'livenet' | 'testnet' | 'regtest';
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
    const { m, n, password } = params;
    const keygen = new ECDSA.KeyGen({
      n,
      m,
      partyId: 0, // the session initiator is always partyId 0
      seed: this.#seed,
      authKey: this.#credentials.requestPrivKey
    });
    this.id = BitcoreLib.crypto.Hash.sha256sha256(this.#seed).toString('hex');
    this.m = parseInt(m as string);
    this.n = parseInt(n as string);
    this.partyId = 0;

    const msg = await keygen.initJoin();
    await this.#request.post('/v1/tss/keygen/' + this.id, { message: msg, n, password, version: TSS_KEYGEN_VERSION });
    this.#keygen = keygen;
    return this;
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
   * @returns {string} Encrypted join code
   */
  createJoinCode(params: {
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
  }): string {
    const { partyId, partyPubKey, opts } = params;
    $.checkArgument(Number.isInteger(partyId) && partyId > 0 && partyId < this.n, 'partyId must be an integer between 1 and n - 1');
    const normalizedPubKey = normalizePubKey(partyPubKey, 'partyPubKey');
    const extra = params.extra || '';
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

    this.#keygen = keygen;
    this.id = id;
    this.chain = chain;
    this.network = network as TssKeyGen['network'];
    this.m = parseInt(m);
    this.n = parseInt(n);
    this.partyId = parseInt(partyId);
    this.#creatorPubKey = creatorPubKey;
    this.#recipientKeys.clear();

    const msg = await keygen.initJoin();
    password = password || extra;
    await this.#request.post('/v1/tss/keygen/' + this.id, { message: msg, password, version: TSS_KEYGEN_VERSION });
    return this;
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
    let decrypted: Buffer;
    if (opts?.noKey) {
      // A noKey code carries no sender key, so the caller must supply the creator's key from a trusted exchange.
      if (!expectedCreatorKey) {
        throw new Error('creatorPubKey is required for a join code created with noKey');
      }
      senderKey = expectedCreatorKey;
      decrypted = ECIES.decrypt({ payload: code, privateKey: authKey, publicKey: senderKey });
    } else {
      senderKey = readEciesSenderPubKey(code);
      decrypted = ECIES.decrypt({ payload: code, privateKey: authKey });
    }

    try {
      if (expectedCreatorKey && senderKey !== expectedCreatorKey) {
        throw new Error('Join code was not issued by the expected creator key');
      }

      // Parsing needs strings, which cannot be wiped. The decrypted buffer is zeroed below.
      const [id, partyId, chain, network, m, n, ...more] = decrypted.toString().split(':');
      assertValidJoinCode({ id, partyId, chain, network, m, n });
      return { id, partyId, chain, network, m, n, extra: more.join(':'), creatorPubKey: senderKey };
    } finally {
      decrypted.fill(0);
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
   * Export the session for storage
   * @returns {string} Session string
   */
  exportSession(): string {
    if (this.#keygen.isKeyChainReady()) {
      throw new Error('Cannot export a completed session. Run getKeyChain() instead.');
    }
    return [this.id, this.partyId, this.m, this.n, this.#keygen.export()].join(':');
  }

  /**
   * Restore a session from a previously exported session
   * @returns {Promise<TssKeyGen>} Restored TSS instance
   */
  async restoreSession(params: {
    /**
     * Session string to restore
     */
    session: string;
  }): Promise<TssKeyGen> {
    const { session } = params;
    const parts = session.split(':');
    const id = parts.slice(0, -4).join(':'); // id may contain colons, so we join all parts except the last 4
    const [partyId, m, n, keygenSession] = parts.slice(-4);
    this.id = id;
    this.m = parseInt(m);
    this.n = parseInt(n);
    this.partyId = parseInt(partyId);
    const keygen = await ECDSA.KeyGen.restore({ session: keygenSession, authKey: this.#credentials.requestPrivKey });
    this.#keygen = keygen;
    return this;
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
   * - `error` => Error: An error occurred during the process. Emits the error. Note that this will not stop the subscription.
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

    this.#subscriptionId = setInterval(async () => {
      if (this.#subscriptionRunning) return;
      this.#subscriptionRunning = true;
      try {
        const thisRound = this.#keygen.getRound();
        const prevRound = thisRound - 1; // Get previous round's messages
        const { body } = await this.#request.get(`/v1/tss/keygen/${this.id}/${prevRound}`) as RequestResponse;

        const hasEveryoneSubmitted = body.messages?.length === this.n - 1; // subtract yourself
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
          if (!body.publicKey) {// || (!body.hasKeyBackup && this.backupKeyShare)) {
            // const encryptedKeyChain = ECIES.encrypt({
            //   message: key.keychain.privateKeyShare.toString('base64') + ':' + key.keychain.reducedPrivateKeyShare.toString('base64'),
            //   publicKey: new BitcoreLib.HDPrivateKey(this.#xPrivKey).publicKey,
            //   privateKey: new BitcoreLib.HDPrivateKey(this.#xPrivKey).privateKey,
            //   opts: { noKey: true }
            // }).toString('base64');
            // await this.#request.post(`/v1/tss/keygen/${this.id}/store`, { publicKey: key.keychain.commonKeyChain, encryptedKeyChain });
            await this.#request.post(`/v1/tss/keygen/${this.id}/store`, { publicKey: key.keychain.commonKeyChain });
            this.emit('tsskeystored');
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
                if (!err.message.includes('TSS_BWS_JOIN_SECRET_NOT_FOUND')) {
                  throw err;
                }
                // Ignore 'No secret found...' since it means the session initiator has not finished created the wallet yet
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
        this.emit('error', err);
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
    this.#credentials.clientDerivedPublicKey = key.getXPubKey(this.network);

    const client = new Client({ baseUrl: this.#request.baseUrl });
    client.fromObj(this.#credentials.toObj());

    const { wallet, secret } = await client.createWallet(
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

    await this.#request.post(`/v1/tss/keygen/${this.id}/secret`, { secret });
    const credObj = client.toObj();
    this.#credentials.addWalletInfo(credObj.walletId, walletName, 1, 1, copayerName, {
      useNativeSegwit: ['P2WPKH', 'P2WSH', 'P2TR'].includes(wallet.addressType),
      segwitVersion: wallet.addressType === 'P2TR' ? 1 : 0,
      tssKeyId: this.id,
    });
    return wallet;
  }

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
    this.#credentials.clientDerivedPublicKey = key.getXPubKey(this.network);

    const { body: { secret } } = await this.#request.get(`/v1/tss/keygen/${this.id}/secret`);

    const client = new Client({ baseUrl: this.#request.baseUrl });
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
  }

  /**
   * Clean up sensitive data from memory.
   * Call this when you are done with the keygen session
   */
  cleanup() {
    this.#keygen?.cleanup();
  }
}