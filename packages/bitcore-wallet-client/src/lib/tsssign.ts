import { ECDSA } from 'bitcore-tss';
import { BitcoreLib, ethers } from 'crypto-wallet-core';
import { EventEmitter } from 'events';
import { Credentials } from './credentials';
import { Request, RequestResponse } from './request';
import { TssKey } from './tsskey';

const $ = BitcoreLib.util.preconditions;

export interface ISignature {
  r: string;
  s: string;
  v: number;
  pubKey: string;
};

export interface ITssSignConstructorParams {
  /**
   * URL of the BWS server
   */
  baseUrl: string;
  /**
   * BWC Key used for signing and encrypting payloads
   */
  credentials: Credentials;
  /**
   * TSS key object
   */
  tssKey: TssKey;
  /**
   * Pre-defined Request object for making HTTP requests.
   * For testing only
   */
  request?: Request;
};


export class TssSign extends EventEmitter {
  #request: Request;
  #sign: ECDSA.Sign;
  #tssKey: TssKey;
  #credentials: Credentials;
  #subscriptionId: ReturnType<typeof setInterval>;
  #subscriptionRunning: boolean;
  id: string;


  /**
   * Threshold Signature Scheme (TSS) client class
   */
  constructor(
    /** Constructor parameters */
    params: ITssSignConstructorParams,
    /** EventEmitter options object */
    eventOpts?
  ) {
    super(eventOpts);
    $.checkArgument(params.baseUrl, 'Missing required param: baseUrl');
    $.checkArgument(params.credentials, 'Missing required param: credentials');
    $.checkArgument(params.credentials instanceof Credentials, 'credentials must be an instance of Credentials');
    $.checkArgument(params.tssKey, 'Missing required param: tssKey');
    $.checkArgument(params.tssKey instanceof TssKey, 'tssKey must be an instance of TssKey');

    this.#request = new Request(params.baseUrl, {
      r: params.request, // For testing only
    });
    this.#credentials = params.credentials;
    this.#request.setCredentials(this.#credentials);
    this.#tssKey = params.tssKey;
  }

  /**
   * Initiate a new Threshold Signature Scheme key generation session
   * @returns {Promise<TssSign>}
   */
  async start(params: {
    /**
     * Pre-hashed message to be signed. Mutually exclusive with `message`.
     */
    messageHash?: Buffer;
    /**
     * Optional ID for the session. If not provided, ID will be generated
     */
    id?: string;
    /**
     * Optional derivation path for the key to sign with
     */
    derivationPath?: string;
    /**
     * Password to decrypt the TSS private key share
     */
    password?: string;
    /**
     * Message string to be signed. Ignored if `messageHash` is provided.
     * 
     * NOTE: This should only be used for signing various string messages like "hello world".
     * Blockchain transactions should be pre-hashed and passed as `messageHash` since
     * they often require specific hashing methods (e.g. EVM => keccak256, UTXO => sha256).
     */
    message?: string | Buffer;
    /**
     * Encoding of the `message` (if a string)
     * @default 'utf8'
     */
    encoding?: BufferEncoding;
  }): Promise<TssSign> {
    let { message, messageHash } = params;
    const { id, derivationPath, password, encoding = 'utf8' } = params;
    $.checkArgument(messageHash || message, 'message or messageHash must be provided');
    $.checkArgument(!messageHash || Buffer.isBuffer(messageHash), 'messageHash must be a Buffer');
    $.checkArgument(!message  || Buffer.isBuffer(message) || typeof message === 'string', 'message must be a string or Buffer');
    $.checkArgument(id == null || typeof id === 'string', 'id must be a string or not provided');
    $.checkArgument(password || this.#tssKey.keychain.privateKeyShare, 'password is required to decrypt the TSS private key share');
    

    if (!messageHash && typeof message === 'string') {
      if (encoding === 'hex') {
        message = message.startsWith('0x') ? message.slice(2) : message; // Remove '0x' prefix if present
      }
      message = Buffer.from(message, encoding);
      messageHash = BitcoreLib.crypto.Hash.sha256(message);
    }

    this.#sign = new ECDSA.Sign({
      keychain: this.#tssKey.get(password).keychain,
      partyId: this.#tssKey.metadata.partyId,
      m: this.#tssKey.metadata.m,
      n: this.#tssKey.metadata.n,
      derivationPath,
      messageHash,
      authKey: this.#credentials.requestPrivKey
    });

    this.id = id || BitcoreLib.crypto.Hash.sha256(messageHash).toString('hex');

    const msg = await this.#sign.initJoin();
    const m = this.#tssKey.metadata.m;
    await this.#request.post('/v1/tss/sign/' + this.id, { message: msg, m });
    return this;
  }

  /**
   * Export the session for storage
   * @returns {string} Session string
   */
  exportSession(): string {
    if (this.#sign.isSignatureReady()) {
      throw new Error('Cannot export a completed session. Run getSignature() instead.');
    }
    return [this.id, this.#sign.export()].join(':');
  }

  /**
   * Restore a session from a previously exported session
   * @returns {Promise<TssSign>} Restored TSS instance
   */
  async restoreSession(params: {
    /**
     * Session string to restore
     */
    session: string;
  }): Promise<TssSign> {
    const { session } = params;
    const [id, sigSession] = session.split(':');
    this.id = id;
    this.#sign = await ECDSA.Sign.restore({
      session: sigSession,
      keychain: this.#tssKey.keychain,
      authKey: this.#credentials.requestPrivKey
    });
    return this;
  }

  /**
   * Subscribe to the TSS signature generation process.
   * Various events will be emitted during the process:
   * - `roundready` => number: A new round is ready to be processed. Emits the round number
   * - `roundprocessed` => number: A round has been processed. Emits the round number
   * - `roundsubmitted` => number: A round has been submitted to the server. Emits the round number
   * - `signature` => ISignature: The signature is ready. Emits the signature object
   * - `complete` => void: The signature generation process is complete
   * - `error` => Error: An error occurred during the process. Emits the error. Note that this will not stop the subscription.
   * @returns {NodeJS.Timeout} Subscription ID
   */
  subscribe(params: {
    /**
     * Timeout in milliseconds for the subscription to check for new messages.
     * @default 1000
     */
    timeout?: number;
    /**
     * Custom function to fire every iteration. Does not fire on error.
     * This is useful for custom handling of the subscription process
     */
    iterHandler?: () => void;
  } = {}): NodeJS.Timeout {
    const { timeout, iterHandler } = params;
    this.#subscriptionId = setInterval(async () => {
      if (this.#subscriptionRunning) return;
      this.#subscriptionRunning = true;
      try {
        const thisRound = this.#sign.getRound();
        const prevRound = thisRound - 1; // Get previous round's messages
        const { body } = await this.#request.get(`/v1/tss/sign/${this.id}/${prevRound}`) as RequestResponse;

        const hasEveryoneSubmitted = body.messages?.length === this.#tssKey.metadata.m;
        if (hasEveryoneSubmitted && !body.signature) {
          this.emit('roundready', thisRound);
          // Snapshot the session in case there's an API failure
          //  since this.#sign can't re-process the messages
          const sessionBak = this.exportSession();
          try {
            const msg = await this.#sign.nextRound(body.messages);
            this.emit('roundprocessed', thisRound);
            // If the signature is ready, there's nothing to send to the server and msg will have empty arrays.
            if (!this.#sign.isSignatureReady()) {
              // For 2 P2P messages (i.e. party of 3), it already exceeds 100 KB (190 KB)
              // Assuming ~80KB per message, the max server size of 2MB would be ~25 P2P messages
              await this.#request.post(`/v1/tss/sign/${this.id}`, { message: msg });
              this.emit('roundsubmitted', thisRound);
            }
          } catch (err) {
            // Restore the session to the previous state
            await this.restoreSession({ session: sessionBak });
            throw err;
          }
        }

        const signature = this.getSignature() || body.signature;
        if (signature) {
          this.emit('signature', signature);
          if (!body.signature) {
            await this.#request.post(`/v1/tss/sign/${this.id}/store`, { signature });
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
   * @param {object} [params]
   * @param {boolean} [params.clearEvents] Whether to remove all event listeners (default: true)
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
   * Get the keychain object if the key generation process is complete
   * @returns {ISignature|null} The keychain object if the key generation process is complete, otherwise null
   */
  getSignature(): ISignature | null {
    if (this.#sign.isSignatureReady()) {
      return this.#sign.getSignature();
    }
    return null;
  }

  async getSignatureFromServer(): Promise<ISignature | null> {
    // round doesn't matter. It should always include the signature if it exists
    const { body } = await this.#request.get(`/v1/tss/sign/${this.id}/1`) as RequestResponse;
    if (body.signature) {
      return body.signature;
    }
    return null;
  }
}