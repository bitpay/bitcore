import { ECDSA, ECIES } from 'bitcore-tss';
import { BitcoreLib } from 'crypto-wallet-core';
import { EventEmitter } from 'events';
import { Credentials } from './credentials';
import { Key } from './key';
import { Request, RequestResponse } from './request';

const $ = BitcoreLib.util.preconditions;

export interface ITssConstructorParams {
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
   * Wallet ID of the support staff
   */
  supportStaffWalletId?: string;
};

export interface IKeyChain {
  privateKeyShare: Buffer;
  reducedPrivateKeyShare: Buffer;
  commonKeyChain: string;
};

export class TssKeyGen extends EventEmitter {
  #request: Request;
  #keygen: ECDSA.KeyGen;
  #key: Key;
  #seed: string;
  #requestPrivateKey: BitcoreLib.PrivateKey;
  #credentials: Credentials;
  #subscriptionId: ReturnType<typeof setInterval>;
  #subscriptionRunning: boolean;
  id: string;
  m: number;
  n: number;
  partyId: number;


  /**
   * Threshold Signature Scheme (TSS) client class
   * @param {ITssConstructorParams} params Constructor parameters
   * @param {EventEmitterOptions} eventOpts Options object for EventEmitter
   */
  constructor(params: ITssConstructorParams, eventOpts) {
    super(eventOpts);
    $.checkArgument(params.baseUrl, 'Missing required param: baseUrl');
    $.checkArgument(params.key, 'Missing required param: key');
    $.checkArgument(params.key instanceof Key, 'key must be an instance of Key');

    this.#request = new Request(params.baseUrl, {
      r: params.request, // For testing only
      supportStaffWalletId: params.supportStaffWalletId
    });
    this.#key = params.key;
    const _xPrivKey = params.key.get(params.password).xPrivKey;
    const _seed = BitcoreLib.HDPrivateKey.fromString(_xPrivKey);
    this.#seed = BitcoreLib.crypto.Hash.sha256(_seed.toBuffer());
    this.#credentials = params.key.createCredentials(params.password, { network: 'livenet', n: 1, account: 0 });
    this.#request.setCredentials(this.#credentials);
    this.#requestPrivateKey = BitcoreLib.PrivateKey.fromString(this.#credentials.requestPrivKey);
  }

  /**
   * Initiate a new Threshold Signature Scheme key generation session
   * @param {object} params
   * @param {number} params.m Number of required signatures
   * @param {number} params.n Number of parties/signers
   * @returns {Promise<string>} Base64 encoded session. You'll need this along with the authKey and seed to restore the session.
   */
  async newKey({ m, n }): Promise<TssKeyGen> {
    const keygen = new ECDSA.KeyGen({
      n,
      m,
      partyId: 0, // the session initiator is always partyId 0
      seed: this.#seed,
      authKey: this.#credentials.requestPrivKey
    });

    this.id = BitcoreLib.crypto.Hash.sha256sha256(this.#seed).toString('hex');
    this.m = parseInt(m);
    this.n = parseInt(n);
    this.partyId = 0;

    const msg = await keygen.initJoin();
    msg.n = n;
    await this.#request.post('/v1/tss/keygen/' + this.id, msg);
    this.#keygen = keygen;
    return this;
  }

  /**
   * Join a Threshold Signature Scheme key
   * @param {object} params
   * @param {string|Buffer} params.code Join code
   * @param {object} [params.opts] Options for the join code. Also contains opts for the ECIES.decrypt method
   * @param {string} [params.opts.encoding] Encoding for the join code (default: 'hex')
   * @param {string} [params.opts.noKey] ECIES.decrypt: The public key is not included the payload
   * @param {string} [params.opts.shortTag] ECIES.decrypt: A short tag was used during encryption
   */
  async joinKey({ code, opts }): Promise<TssKeyGen> {
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
    await this.#request.post('/v1/tss/keygen/' + this.id, msg);
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
   * @param {object} params
   * @param {string} params.session Session string to restore
   * @returns {Promise<Tss>} Restored TSS instance
   */
  async restoreSession({ session }): Promise<TssKeyGen> {
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
   * Create an invidation code for a party to join the TSS key
   * @param params
   * @param {number} params.partyId Party ID to create the join code for
   * @param {string} params.partyPubKey Public key of the party to encrypt the join code to
   * @param {string} [params.extra] Extra data to include in the join code
   * @param {object} [params.opts] Options for the join code. Also contains opts for the ECIES.encrypt method
   * @param {string} [params.opts.encoding] Encoding for the join code (default: 'hex')
   * @param {string} [params.opts.noKey] ECIES.encrypt: Don't include the public key in the result
   * @param {string} [params.opts.shortTag] ECIES.encrypt: Use a short tag
   * @param {boolean} [params.opts.deterministicIv] ECIES.encrypt: Use a deterministic IV
   * @returns {string} Encrypted join code
   */
  createJoinCode({ partyId, partyPubKey, extra, opts }): string {
    extra = extra || '';
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
   * Subscribe to the TSS key generation process.
   * Various events will be emitted during the process:
   * - `roundready` => void: A new round is ready to be processed
   * - `roundprocessed` => void: A round has been processed
   * - `roundsubmitted` => number: A round has been submitted to the server. Emits the submitted round number
   * - `keychain` => IKeyChain: The keychain is ready. Emits the keychain object
   * - `complete` => void: The key generation process is complete
   * - `error` => Error: An error occurred during the process. Emits the error
   * @param {object} [params]
   * @param {number} [params.timeout] Timeout in milliseconds for the subscription to check for new messages (default: 1000)
   * @param {function} [params.iterHandler] Custom function to fire every iteration. Does not fire on error. 
   * @returns {NodeJS.Timeout} Subscription ID
   */
  subscribe({ timeout, iterHandler }: { timeout?: number; iterHandler?: () => void } = {}): NodeJS.Timeout {
    this.#subscriptionId = setInterval(async () => {
      if (this.#subscriptionRunning) return;
      this.#subscriptionRunning = true;
      try {
        const prevRound = this.#keygen.getRound() - 1; // Get previous round's messages
        const { body } = await this.#request.get(`/v1/tss/keygen/${this.id}/${prevRound}`) as RequestResponse;

        if (body.messages?.length === this.n - 1) {
          this.emit('roundready');
          // Snapshot the session in case there's an API failure
          //  since this.#keygen can't re-process the messages
          const sessionBak = this.exportSession();
          try {
            const msg = await this.#keygen.nextRound(body.messages);
            this.emit('roundprocessed');
            // For 2 P2P messages (i.e. party of 3), it already exceeds 100 KB (190 KB)
            // Assuming ~80KB per message, the max server size of 2MB would be ~25 P2P messages
            await this.#request.post(`/v1/tss/keygen/${this.id}`, msg);
            this.emit('roundsubmitted', prevRound + 1);
          } catch (err) {
            // Restore the session to the previous state
            await this.restoreSession({ session: sessionBak });
            throw err;
          }
        }

        const keyChain = this.getKeyChain();
        if (keyChain) {
          this.emit('keychain', keyChain);
          await this.#request.post(`/v1/tss/keygen/${this.id}/store`, { publicKey: keyChain.commonKeyChain });
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
   * @param {object} [params]
   * @param {boolean} [params.clearEvents] Whether to remove all event listeners (default: true)
   */
  unsubscribe({ clearEvents }: { clearEvents: boolean } = { clearEvents: true}): void {
    clearInterval(this.#subscriptionId);
    if (clearEvents) {
      this.removeAllListeners();
    }
    this.#subscriptionId = null;
    this.#subscriptionRunning = false;
  }

  /**
   * Get the keychain object if the key generation process is complete
   * @returns {IKeyChain|null} The keychain object if the key generation process is complete, otherwise null
   */
  getKeyChain(): IKeyChain | null {
    if (this.#keygen.isKeyChainReady()) {
      return this.#keygen.getKeyChain();
    }
    return null;
  }
}