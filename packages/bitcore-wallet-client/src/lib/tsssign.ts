import { ECDSA } from 'bitcore-tss';
import { BitcoreLib } from 'crypto-wallet-core';
import { EventEmitter } from 'events';
import { Credentials } from './credentials';
import { Request, RequestResponse } from './request';
import { TssKey } from './tsskeygen';

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
  #requestPrivateKey: BitcoreLib.PrivateKey;
  #subscriptionId: ReturnType<typeof setInterval>;
  #subscriptionRunning: boolean;
  id: string;


  /**
   * Threshold Signature Scheme (TSS) client class
   * @param {ITssConstructorParams} params Constructor parameters
   * @param {EventEmitterOptions} eventOpts Options object for EventEmitter
   */
  constructor(params: ITssSignConstructorParams, eventOpts) {
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
    this.#requestPrivateKey = BitcoreLib.PrivateKey.fromString(this.#credentials.requestPrivKey);
    this.#tssKey = params.tssKey;
  }

  /**
   * Initiate a new Threshold Signature Scheme key generation session
   * @param {object} params
   * @param {string|Buffer} params.message Message to be signed
   * @param {string} [params.id] Optional ID for the session. If not provided, ID will be generated
   * @returns {Promise<TssSign>}
   */
  async start({ message, id }: { message: string | Buffer, id?: string }): Promise<TssSign> {
    $.checkArgument(Buffer.isBuffer(message) || typeof message === 'string', 'message must be a string or Buffer');
    $.checkArgument(id == null || typeof id === 'string', 'id must be a string or not provided');
    
    message = Buffer.isBuffer(message) ? message : Buffer.from(message);
    const messageHash = BitcoreLib.crypto.Hash.sha256(message);
    const sign = new ECDSA.Sign({
      keychain: this.#tssKey.keychain,
      partyId: this.#tssKey.metadata.partyId,
      m: this.#tssKey.metadata.m,
      n: this.#tssKey.metadata.n,
      messageHash,
      authKey: this.#credentials.requestPrivKey
    });

    this.id = id || BitcoreLib.crypto.Hash.sha256(messageHash).toString('hex');

    const msg = await sign.initJoin();
    msg.m = this.#tssKey.metadata.m;
    await this.#request.post('/v1/tss/sign/' + this.id, msg);
    this.#sign = sign;
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
   * @param {object} params
   * @param {string} params.session Session string to restore
   * @returns {Promise<TssSign>} Restored TSS instance
   */
  async restoreSession({ session }): Promise<TssSign> {
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
   * - `roundready` => void: A new round is ready to be processed
   * - `roundprocessed` => void: A round has been processed
   * - `roundsubmitted` => number: A round has been submitted to the server. Emits the submitted round number
   * - `signature` => ISignature: The signature is ready. Emits the signature object
   * - `complete` => void: The signature generation process is complete
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
        const thisRound = this.#sign.getRound();
        const prevRound = thisRound - 1; // Get previous round's messages
        const { body } = await this.#request.get(`/v1/tss/sign/${this.id}/${prevRound}`) as RequestResponse;

        if (body.messages?.length === this.#tssKey.metadata.m - 1) {
          this.emit('roundready', thisRound);
          // Snapshot the session in case there's an API failure
          //  since this.#sign can't re-process the messages
          const sessionBak = this.exportSession();
          try {
            const msg = await this.#sign.nextRound(body.messages);
            this.emit('roundprocessed', thisRound);
            // For 2 P2P messages (i.e. party of 3), it already exceeds 100 KB (190 KB)
            // Assuming ~80KB per message, the max server size of 2MB would be ~25 P2P messages
            await this.#request.post(`/v1/tss/sign/${this.id}`, msg);
            this.emit('roundsubmitted', thisRound);
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
   * @returns {ISignature|null} The keychain object if the key generation process is complete, otherwise null
   */
  getSignature(): ISignature | null {
    if (this.#sign.isSignatureReady()) {
      return this.#sign.getSignature();
    }
    return null;
  }
}