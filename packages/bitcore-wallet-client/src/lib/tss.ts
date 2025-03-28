import { KeyGen, Sign } from 'bitcore-tss';
import { EventEmitter } from 'events';
import { Request } from './request';

export class Tss {
  request: Request;
  events: EventEmitter;

  /**
   * Threshold Signature Scheme (TSS) client class
   * @param {Object} params
   * @param {string} params.baseUrl - URL of the BWS server
   * @param {string} [params.supportStaffWalletId] - Wallet ID of the support staff
   */
  constructor(params) {
    this.request = new Request(params.baseUrl, {
      supportStaffWalletId: params.supportStaffWalletId
    });
    this.events = new EventEmitter();
  }

  /**
   * Initiate a new Threshold Signature Scheme key
   * @param {Object} opts
   * @param {number} opts.m - Number of required signatures
   * @param {number} opts.n - Number of parties/signers
   * @param {Buffer} opts.seed - Seed for key generation
   * @param {Buffer} opts.authKey - Key for signing and encrypting round payloads & authenticating to BWS
   */
  async newKey(opts) {
    const keygen = new KeyGen({
      n: opts.n,
      m: opts.m,
      partyId: 0,
      seed: opts.seed,
      authKy: opts.authKey
    });

    const msg = await keygen.initJoin();
    this.request.post('/v1/tss/keygen', msg);
  }

  static joinKey(opts) {

  }

}