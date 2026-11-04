import { EventEmitter } from 'events';
import { ECDSA, ECIES } from '@bitpay-labs/bitcore-tss';
import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { API as Client, CreateWalletOpts } from './api';
import { Constants, Encryption, Utils } from './common';
import { Credentials } from './credentials';
import { ExportedKey, Key, type KeyAlgorithm, type PasswordMaybe } from './key';
import { Request, RequestResponse } from './request';

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
    /**
     * Chain of the key generation session. The session's copayer IDs are derived with this chain.
     * Missing for keys generated before sibling wallet support.
     */
    keygenChain?: string;
    /**
     * Network of the key generation session. The session's copayer IDs are derived from the xPubKey serialized for this network.
     * Missing for keys generated before sibling wallet support.
     */
    keygenNetwork?: string;
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
        partyId: this.metadata.partyId,
        keygenChain: this.metadata.keygenChain,
        keygenNetwork: this.metadata.keygenNetwork
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
  #roster: { [partyId: number]: string } = {};
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
    const extra = params.extra || '';
    this.#roster[partyId] = partyPubKey;
    await this.#request.post('/v1/tss/keygen/' + this.id + '/register', { partyId, partyPubKey });
    const data = [this.id, partyId, this.chain, this.network, this.m, this.n, extra].join(':');
    const code = ECIES.encrypt({
      message: data,
      publicKey: partyPubKey,
      privateKey: this.#requestPrivateKey,
      opts
    });
    return code.toString(opts?.encoding || 'hex');
  }

  checkJoinCode(params: {
    code: string | Buffer;
    opts?: {
      /**
       * Encoding for the join code (default: 'hex')
       */
      encoding?: BufferEncoding;
    };
  }) {
    let { code } = params;
    const { opts } = params;
    $.checkArgument(code, 'Missing required param: code');
    $.checkArgument(typeof code === 'string' || Buffer.isBuffer(code), '`code` must be a string or buffer');
    code = Buffer.isBuffer(code) ? code : Buffer.from(code, opts?.encoding || 'hex');
    const authKey = this.#credentials.requestPrivKey;
    const decryptedCode = ECIES.decrypt({ payload: code, privateKey: authKey }).toString();
    const [id, partyId, chain, network, m, n] = decryptedCode.split(':');
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
    const decryptedCode = ECIES.decrypt({ payload: code, privateKey: authKey }).toString();
    const [id, partyId, chain, network, m, n, ...more] = decryptedCode.split(':');
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
    this.chain = chain;
    this.network = network;
    this.m = parseInt(m);
    this.n = parseInt(n);
    this.partyId = parseInt(partyId);

    const msg = await keygen.initJoin();
    password = password || extra;
    await this.#request.post('/v1/tss/keygen/' + this.id, { message: msg, password, version: TSS_KEYGEN_VERSION });
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
    const roster = JSON.stringify(Object.entries(this.#roster));
    return [this.id, this.partyId, this.m, this.n, roster, this.#keygen.export()].join(':');
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
    const id = parts.slice(0, -5).join(':'); // id may contain colons, so we join all parts except the last 5
    const [partyId, m, n, roster, keygenSession] = parts.slice(-5);
    this.id = id;
    this.m = parseInt(m);
    this.n = parseInt(n);
    this.partyId = parseInt(partyId);
    const keygen = await ECDSA.KeyGen.restore({ session: keygenSession, authKey: this.#credentials.requestPrivKey });
    this.#keygen = keygen;
    this.#roster = Object.fromEntries(JSON.parse(roster));
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
     * You can manually create/join wallets later via the createWallet()/joinWallet() methods.
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
              wallet = await this._createWallet({
                walletName,
                copayerName,
                opts: createWalletOpts
              });
            } else if (this.partyId > 0) {
              try {
                wallet = await this._joinWallet({ copayerName });
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
          partyId: this.partyId,
          keygenChain: this.#credentials.chain,
          keygenNetwork: this.#credentials.network
        }
      });
      if (password) {
        key.encrypt(password);
      }
      return key;
    }
    return null;
  }

  async _createWallet(params: {
    walletName: string;
    copayerName: string;
    opts?: CreateWalletOpts & { addressType?: string };
  }) {
    const { walletName, copayerName, opts = {} } = params;
    const key = this.getTssKey();
    if (!key) {
      throw new Error('TSS Key generation is not complete. This should be called after the `complete` event is emitted.');
    }
    const { wallet } = await createWallet({
      baseKey: key,
      baseCredentials: this.#credentials,
      baseUrl: this.#request.baseUrl,
      request: this.#request.r,
      walletName,
      copayerName,
      parties: this.#roster,
      opts: Object.assign({}, opts, {
        chain: this.chain,
        network: this.network,
      })
    });
    return wallet;
  }

  async _joinWallet(params: {
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
    const { wallet } = await joinWallet({
      baseKey: key,
      baseCredentials: this.#credentials,
      baseUrl: this.#request.baseUrl,
      request: this.#request.r,
      copayerName,
      opts: Object.assign({}, opts, {
        chain: this.chain,
        network: this.network
      })
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

interface ITssWalletParams {
  /** The TSS key */
  baseKey: TssKey;
  /**
   * Credentials of the TSS key generation session or of a wallet created with `baseKey`.
   * The leader's `publicKeyRing` must contain every party unless `parties` is given to createWallet().
   */
  baseCredentials: Credentials;
  /** URL of the BWS server */
  baseUrl: string;
  /** Name of the party/copayer */
  copayerName: string;
  /**
   * Pre-defined request object for making HTTP requests.
   * For testing only
   */
  request?: Request;
};

/**
 * Create a BWS wallet for a TSS key. Only the TSS session leader (partyId 0) can create the wallet.
 * The other parties then join it with joinWallet().
 * opts.chain/network can be used to create a sibling wallet on another chain than the one used for the key generation
 *  (e.g. the key was generated for 'eth', now create an 'arb' wallet with the same key/address).
 */
export async function createWallet(params: ITssWalletParams & {
  walletName: string;
  /**
   * Auth (request) public keys of the other parties, keyed by partyId or by keygen session copayer ID.
   * The BWS join secret is encrypted to each of these keys.
   * Default: the other copayers in `baseCredentials.publicKeyRing`
   */
  parties?: { [partyIdOrCopayerId: string]: string };
  opts?: CreateWalletOpts & { addressType?: string };
}) {
  const { baseKey, baseCredentials, baseUrl, walletName, copayerName, request, opts = {} } = params;
  $.checkArgument(baseKey instanceof TssKey, 'baseKey must be an instance of TssKey');
  $.checkArgument(baseKey.metadata.partyId === 0, 'Only the TSS key session leader can create the wallet. Try calling joinWallet()');

  const keygenChain = getKeygenChain(baseKey, baseCredentials);
  const keygenNetwork = getKeygenNetwork(baseKey, baseCredentials);
  const parties = params.parties || getOtherParties(baseCredentials, keygenChain, keygenNetwork);
  if (Object.keys(parties).length !== baseKey.metadata.n - 1) {
    throw new Error('Missing the public keys of some TSS parties. Every party must join the base wallet first and baseCredentials must be up to date (see openWallet()).');
  }

  const { chain, coin, network } = getChainNetwork(baseCredentials, opts);
  const client = new Client({ baseUrl, request });
  client.fromObj(getWalletCredentials({ baseKey, baseCredentials, chain, coin, network }).toObj());

  let wallet;
  try {
    ({ wallet } = await client.createWallet(
      walletName,
      copayerName,
      baseKey.metadata.m,
      baseKey.metadata.n,
      Object.assign({}, opts, {
        chain,
        coin,
        network,
        tssKeyId: baseKey.metadata.id,
        tssKeygenChain: keygenChain,
        tssKeygenCopayerId: getKeygenCopayerId(baseCredentials, keygenChain, keygenNetwork)
      })
    ));
  } catch (err) {
    if (!err.message?.includes('Copayer ID already registered')) {
      throw err;
    }
    // The wallet already exists (e.g. a previous attempt failed to store the join secrets).
    // Recover its walletPrivKey from this copayer's customData so that the join secret can be rebuilt.
    client.credentials.walletPrivKey = null;
    ({ wallet } = await client.getStatus({ includeExtendedInfo: true }));
    if (wallet.tssKeyId !== baseKey.metadata.id || wallet.chain !== chain) {
      throw new Error(`Copayer is already registered in another wallet: ${wallet.id}`);
    }
  }

  // Submit the join secret, encrypted for each of the other parties
  const c = client.credentials;
  const secret = Client._buildSecret(wallet.id, c.walletPrivKey, c.coin, c.network);
  const secrets = {};
  for (const [party, publicKey] of Object.entries(parties)) {
    secrets[party] = ECIES.encrypt({ message: secret, publicKey, privateKey: c.requestPrivKey }).toString('hex');
  }
  await getKeygenSessionRequest({ baseCredentials, keygenChain, keygenNetwork, baseUrl, request })
    .post(`/v1/tss/keygen/${baseKey.metadata.id}/secret`, { chain, network, secrets });
  setKeygenSession(baseKey, keygenChain, keygenNetwork);

  addTssWalletInfo(c, wallet, walletName, copayerName, baseKey.metadata.id);
  return { wallet, credentials: c };
}

/**
 * Join a BWS wallet created by the TSS session leader with createWallet().
 * opts.chain/network must match those given to createWallet().
 */
export async function joinWallet(params: ITssWalletParams & {
  opts?: {
    chain?: string;
    coin?: string;
    network?: string;
    dryRun?: boolean;
  };
}) {
  const { baseKey, baseCredentials, baseUrl, copayerName, request, opts = {} } = params;
  $.checkArgument(baseKey instanceof TssKey, 'baseKey must be an instance of TssKey');

  const keygenChain = getKeygenChain(baseKey, baseCredentials);
  const keygenNetwork = getKeygenNetwork(baseKey, baseCredentials);
  const { chain, coin, network } = getChainNetwork(baseCredentials, opts);
  const credentials = getWalletCredentials({ baseKey, baseCredentials, chain, coin, network });

  const qs = new URLSearchParams({ chain, network });
  const { body: { secret } } = await getKeygenSessionRequest({ baseCredentials, keygenChain, keygenNetwork, baseUrl, request })
    .get(`/v1/tss/keygen/${baseKey.metadata.id}/secret?${qs}`);
  setKeygenSession(baseKey, keygenChain, keygenNetwork);
  const decryptedSecret = ECIES.decrypt({ payload: Buffer.from(secret, 'hex'), privateKey: credentials.requestPrivKey }).toString();

  const client = new Client({ baseUrl, request });
  client.fromObj(credentials.toObj());
  let wallet;
  try {
    wallet = await client.joinWallet(decryptedSecret, copayerName, {
      chain,
      coin,
      dryRun: opts.dryRun,
      tssKeygenChain: keygenChain
    });
  } catch (err) {
    if (!err.message?.includes('Copayer already in wallet')) {
      throw err;
    }
    ({ wallet } = await client.getStatus());
  }

  if (!opts.dryRun) {
    addTssWalletInfo(client.credentials, wallet, wallet.name, copayerName, baseKey.metadata.id);
  }
  return { wallet, credentials: client.credentials };
}

/** Chain of the key generation session, which the session's copayer IDs are derived with */
function getKeygenChain(baseKey: TssKey, baseCredentials: Credentials): string {
  return baseKey.metadata.keygenChain || baseCredentials.chain;
}

/** Network of the key generation session, which the xPubKey in the session's copayer IDs is serialized for */
function getKeygenNetwork(baseKey: TssKey, baseCredentials: Credentials): string {
  return baseKey.metadata.keygenNetwork || baseCredentials.network;
}

/**
 * Store the keygen chain and network on keys generated before they were stored. Call it only after BWS accepted a
 * keygen session request made with them, which confirms them. Otherwise, a sibling wallet saved with the key would
 * fall back to the sibling's chain and network.
 */
function setKeygenSession(baseKey: TssKey, keygenChain: string, keygenNetwork: string) {
  baseKey.metadata.keygenChain ??= keygenChain;
  baseKey.metadata.keygenNetwork ??= keygenNetwork;
}

function getChainNetwork(baseCredentials: Credentials, opts: { chain?: string; coin?: string; network?: string }) {
  const chain = (opts.chain || baseCredentials.chain).toLowerCase();
  return {
    chain,
    coin: opts.coin || chain,
    network: opts.network || baseCredentials.network
  };
}

/**
 * Serialize an xPubKey for another network. The key itself doesn't change, only its version bytes do.
 * Like Key.convertXPrivKeyToNetwork(), anything but testnet/regtest is livenet.
 */
function convertXPubKeyToNetwork(xPubKey: string, network: string): string {
  const x = new BitcoreLib.HDPublicKey(xPubKey).toObject();
  x.network = ['testnet', 'regtest'].includes(network) ? network : 'livenet';
  delete x.xpubkey;
  delete x.checksum;
  return new BitcoreLib.HDPublicKey(x).toString();
}

/** This party's copayer ID in the keygen session */
function getKeygenCopayerId(baseCredentials: Credentials, keygenChain: string, keygenNetwork: string): string {
  return Utils.xPubToCopayerId(keygenChain, convertXPubKeyToNetwork(baseCredentials.xPubKey, keygenNetwork));
}

/** Auth (request) public keys of the other copayers, keyed by keygen session copayer ID */
function getOtherParties(baseCredentials: Credentials, keygenChain: string, keygenNetwork: string) {
  const parties: { [copayerId: string]: string } = {};
  for (const copayer of baseCredentials.publicKeyRing || []) {
    if (copayer.requestPubKey !== baseCredentials.requestPubKey) {
      parties[Utils.xPubToCopayerId(keygenChain, convertXPubKeyToNetwork(copayer.xPubKey, keygenNetwork))] = copayer.requestPubKey;
    }
  }
  return parties;
}

/** Credentials for a new wallet on `chain`:`network` that uses the TSS key */
function getWalletCredentials(params: {
  baseKey: TssKey;
  baseCredentials: Credentials;
  chain: string;
  coin: string;
  network: string;
}) {
  const { baseKey, baseCredentials, chain, coin, network } = params;
  // The copayer xPubKey is network-specific, so serialize it for the wallet's network
  const xPubKey = convertXPubKeyToNetwork(baseCredentials.xPubKey, network);
  return Credentials.fromObj({
    ...baseCredentials.toObj(),
    chain,
    coin,
    network,
    xPubKey,
    copayerId: Utils.xPubToCopayerId(chain, xPubKey),
    clientDerivedPublicKey: baseKey.getXPubKey(network),
    // Clear the base wallet's info
    walletId: undefined,
    walletName: undefined,
    walletPrivKey: undefined,
    sharedEncryptingKey: undefined,
    publicKeyRing: [],
    token: undefined,
    multisigEthInfo: undefined
  });
}

/** Request object authenticated with this party's copayer ID in the TSS key generation session */
function getKeygenSessionRequest(params: {
  baseCredentials: Credentials;
  keygenChain: string;
  keygenNetwork: string;
  baseUrl: string;
  request?: Request;
}) {
  const { baseCredentials, keygenChain, keygenNetwork, baseUrl, request } = params;
  const keygenCredentials = Credentials.fromObj({
    ...baseCredentials.toObj(),
    chain: keygenChain,
    copayerId: getKeygenCopayerId(baseCredentials, keygenChain, keygenNetwork)
  });
  const keygenRequest = new Request(baseUrl, { r: request });
  keygenRequest.setCredentials(keygenCredentials);
  return keygenRequest;
}

function addTssWalletInfo(credentials: Credentials, wallet, walletName: string, copayerName: string, tssKeyId: string) {
  credentials.addWalletInfo(wallet.id, walletName, 1, 1, copayerName, {
    useNativeSegwit: Utils.isNativeSegwit(wallet.addressType),
    segwitVersion: Utils.getSegwitVersion(wallet.addressType),
    tssKeyId
  });
  credentials.addressType = wallet.addressType;
}
