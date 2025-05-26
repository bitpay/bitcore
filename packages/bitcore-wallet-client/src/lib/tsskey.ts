import { ECDSA, ECIES } from 'bitcore-tss';
import { BitcoreLib } from 'crypto-wallet-core';
import { EventEmitter } from 'events';
import { Credentials } from './credentials';
import { Key } from './key';
import { Request, RequestResponse } from './request';

const $ = BitcoreLib.util.preconditions;

export interface ITssKeyGenConstructorParams {
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
   * Default: true
   */
  backupKeyShare?: boolean;
};

export interface ITssKey extends Key {
  keychain: {
    privateKeyShare: Buffer;
    reducedPrivateKeyShare: Buffer;
    commonKeyChain: string;
  },
  metadata: {
    id: string;
    m: number;
    n: number;
    partyId: number;
  }
};

export class TssKey extends Key implements ITssKey {
  keychain: ITssKey['keychain'];
  metadata: ITssKey['metadata'];

  constructor(obj: ITssKey) {
    super({ seedType: 'object', seedData: obj });
    this.keychain = obj.keychain;
    this.metadata = obj.metadata;
  }

  toObj(): ITssKey {
    return {
      ...super.toObj(),
      keychain: this.keychain,
      metadata: this.metadata,
    };
  }

  static fromObj(obj: ITssKey): TssKey {
    const key = new TssKey(obj);
    return key;
  }

  createCredentials(
    password?: string,
    opts?: {
      coin?: string;
      chain?: string;
      network?: string;
      account?: number;
      n?: number;
      addressType?: string;
      walletPrivKey?: string;
      algo?: 'EDDSA' | 'ECDSA';
    }
  ): Credentials {
    const publicKey = this.keychain.commonKeyChain.substring(0, 66);
    const chainCode = this.keychain.commonKeyChain.substring(66);
    const c = super.createCredentials(password, opts);
    const xPubKey = new BitcoreLib.HDPublicKey({
      network: (opts.network && BitcoreLib.Networks.get(opts.network)) || 'testnet',
      depth: 0,
      parentFingerPrint: 0,
      childIndex: 0,
      publicKey,
      chainCode
    });
    // c.xPubKey = xPubKey.toString();
    // c.publicKeyRing[0].xPubKey = c.xPubKey;
    return c;
  }
};

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
  id: string;
  m: number;
  n: number;
  partyId: number;
  backupKeyShare: boolean;


  /**
   * Threshold Signature Scheme (TSS) client class
   * @param {ITssKeyGenConstructorParams} params Constructor parameters
   * @param {EventEmitterOptions} eventOpts Options object for EventEmitter
   */
  constructor(params: ITssKeyGenConstructorParams, eventOpts) {
    super(eventOpts);
    $.checkArgument(params.baseUrl, 'Missing required param: baseUrl');
    $.checkArgument(params.key, 'Missing required param: key');
    $.checkArgument(params.key instanceof Key, 'key must be an instance of Key');

    this.#request = new Request(params.baseUrl, {
      r: params.request, // For testing only
    });
    this.#key = params.key;
    this.#xPrivKey = this.#key.get(params.password).xPrivKey;
    const _seed = BitcoreLib.HDPrivateKey.fromString(this.#xPrivKey);
    this.#seed = BitcoreLib.crypto.Hash.sha256(_seed.toBuffer());
    this.#credentials = this.#key.createCredentials(params.password, { network: 'livenet', n: 1, account: 0 });
    this.#request.setCredentials(this.#credentials);
    this.#requestPrivateKey = BitcoreLib.PrivateKey.fromString(this.#credentials.requestPrivKey);
    this.backupKeyShare = !!params.backupKeyShare || true;
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
    await this.#request.post('/v1/tss/keygen/' + this.id, { message: msg, n, password });
    this.#keygen = keygen;
    return this;
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
      encoding?: 'hex' | 'base64' | 'utf8' | 'binary';
      /**
       * ECIES.encrypt: Don't include the public key in the result
       */
      noKey?: boolean;
      /**
       * ECIES.encrypt: Use a short tag
       */
      shortTag?: boolean;
      /**
       * ECIES.encrypt: Use a deterministic IV
       */
      deterministicIv?: boolean;
    }
  }): string {
    const { partyId, partyPubKey, opts } = params;
    const extra = params.extra || '';
    const data = [this.id, partyId, this.m, this.n, extra].join(':');
    const code = ECIES.encrypt({
      message: data,
      publicKey: partyPubKey,
      privateKey: this.#requestPrivateKey,
      opts
    });
    return code.toString(opts?.encoding || 'hex');
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
      encoding?: 'hex' | 'base64' | 'utf8' | 'binary';
      /**
       * ECIES.decrypt: The public key is not included in the payload
       */
      noKey?: boolean;
      /**
       * ECIES.decrypt: A short tag was used during encryption
       */
      shortTag?: boolean;
    };
    /**
     * Server password to join the TSS key. This was set by the initiator and should be told to you by them.
     */
    password?: string;
  }): Promise<TssKeyGen> {
    let { code, password } = params;
    const { opts } = params;
    $.checkArgument(code, 'Missing required param: code');
    $.checkArgument(typeof code === 'string' || Buffer.isBuffer(code), '`code` must be a string or buffer');

    code = Buffer.isBuffer(code) ? code : Buffer.from(code, opts?.encoding || 'hex');

    const authKey = this.#credentials.requestPrivKey;
    const decryptedCode = ECIES.decrypt({ payload: code, privateKey: authKey, opts }).toString();
    const [id, partyId, m, n, ...more] = decryptedCode.split(':');
    const extra = more.join(':');

    const keygen = new ECDSA.KeyGen({
      m,
      n,
      partyId,
      seed: this.#seed,
      authKey
    });

    this.#keygen = keygen;
    this.id = id;
    this.m = parseInt(m);
    this.n = parseInt(n);
    this.partyId = parseInt(partyId);

    const msg = await keygen.initJoin();
    password = password || extra;
    await this.#request.post('/v1/tss/keygen/' + this.id, { message: msg, password });
    return this;
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
    const [id, partyId, m, n, keygenSession] = session.split(':');
    this.id = id;
    this.m = parseInt(m);
    this.n = parseInt(n);
    this.partyId = parseInt(partyId);
    const keygen = await ECDSA.KeyGen.restore({ session: keygenSession, authKey: this.#credentials.requestPrivKey });
    this.#keygen = keygen;
    return this;
  }

  /**
   * Subscribe to the TSS key generation process.
   * Various events will be emitted during the process:
   * - `roundready` => number: A new round is ready to be processed. Emits the round number
   * - `roundprocessed` => number: A round has been processed. Emits the round number
   * - `roundsubmitted` => number: A round has been submitted to the server. Emits the round number
   * - `keychain` => IKeyChain: The keychain is ready. Emits the keychain object
   * - `complete` => void: The key generation process is complete
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
  } = {}): NodeJS.Timeout {
    const { timeout, iterHandler } = params;
    this.#subscriptionId = setInterval(async () => {
      if (this.#subscriptionRunning) return;
      this.#subscriptionRunning = true;
      try {
        const thisRound = this.#keygen.getRound();
        const prevRound = thisRound - 1; // Get previous round's messages
        const { body } = await this.#request.get(`/v1/tss/keygen/${this.id}/${prevRound}`) as RequestResponse;

        if (body.messages?.length === this.n - 1) {
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
              await this.#request.post(`/v1/tss/keygen/${this.id}`, { message: msg });
              this.emit('roundsubmitted', thisRound);
            }
          } catch (err) {
            // Restore the session to the previous state
            await this.restoreSession({ session: sessionBak });
            throw err;
          }
        }

        const key = this.getKeyChain();
        if (key) {
          this.emit('keychain', key);
          if (!body.publicKey || (!body.hasKeyBackup && this.backupKeyShare)) {
            const encryptedKeyChain = ECIES.encrypt({
              message: key.keychain.privateKeyShare.toString('base64') + ':' + key.keychain.reducedPrivateKeyShare.toString('base64'),
              publicKey: new BitcoreLib.HDPrivateKey(this.#xPrivKey).publicKey,
              privateKey: new BitcoreLib.HDPrivateKey(this.#xPrivKey).privateKey,
              opts: { noKey: true }
            }).toString('base64');
            await this.#request.post(`/v1/tss/keygen/${this.id}/store`, { publicKey: key.keychain.commonKeyChain, encryptedKeyChain });
          }
          this.emit('complete');
          if (iterHandler) iterHandler();
          this.unsubscribe();
          // Anything after unsubscribe() will not be executed
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
   */
  unsubscribe(params: {
    /**
     * Whether to remove all event listeners
     * @default true
     */
    clearEvents: boolean;
  } = { clearEvents: true}): void {
    const { clearEvents } = params;
    clearInterval(this.#subscriptionId);
    if (clearEvents) {
      this.removeAllListeners();
    }
    this.#subscriptionId = null;
    this.#subscriptionRunning = false;
  }

  /**
   * Get the key object if the key generation process is complete
   * @returns {TssKey|null} The keychain object if the key generation process is complete, otherwise null
   */
  getKeyChain(): TssKey | null {
    if (this.#keygen.isKeyChainReady()) {
      const key = TssKey.fromObj({
        ...this.#key.toObj(),
        keychain: this.#keygen.getKeyChain(),
        metadata: {
          id: this.id,
          m: this.m,
          n: this.n,
          partyId: this.partyId
        }
      });
      return key;
    }
    return null;
  }
}