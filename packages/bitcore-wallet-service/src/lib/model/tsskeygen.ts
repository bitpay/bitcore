import { singleton } from 'preconditions';
import { Common } from '../common';

const $ = singleton();

const { Defaults } = Common;


export interface ITssKeyMessageObject {
  broadcastMessages: Array<{
    from: number;
    payload: {
      message: string;
      signature: string;
    };
  }>;
  p2pMessages: Array<{
    to: number;
    from: number;
    commitment: string;
    payload: {
      encryptedMessage: string;
      signature: string;
    };
  }>;
  partyId: number;
  publicKey: string;
  round: number;
};

export interface ITssKeyGenModel {
  /**
   * The ID of the TSS key generation session.
   */
  id: string;
  /**
   * The version of the BWC/BWS TSS key generation scheme.
   * This should be incremented any time there are breaking changes to the way
   *  BWC & BWS communicate.
   */
  schemeVersion: number;
  /**
   * The number of participants in the TSS key generation process.
   */
  n: number;
  /**
   * The list of public keys of the participants in the TSS key generation process.
   * The pub keys are in partyId order.
   */
  participants: Array<string>;
  /**
   * An array of the rounds in round order. Each round is an array of messages
   */
  rounds: Array<Array<{
    fromPartyId: number;
    messages: ITssKeyMessageObject;
  }>>;
  /**
   * The public key generated as the result of the TSS key generation process.
   */
  sharedPublicKey?: string;
  /**
   * The password used to join the TSS key generation process.
   */
  joinPassword?: string;
  /**
   * Key shares for each participant encrypted to themseleves.
   */
  keyShares?: Array<string>;
  /**
   * Timestamp the session was created
   */
  createdOn: number;
  /**
   * Session expires after this many milliseconds.
   */
  timeLimit?: number;
  /**
   * The BWC-generated secret for joining a BWS wallet
   */
  bwsJoinSecret?: string;
  /**
   * The mongo doc version
   */
  __v: number;
};

export class TssKeyGenModel implements ITssKeyGenModel {
  id: string;
  n: number;
  participants: Array<string>;
  rounds: Array<Array<{
    fromPartyId: number;
    messages: ITssKeyMessageObject;
  }>>;
  sharedPublicKey?: string;
  schemeVersion: number;
  joinPassword?: string;
  keyShares?: Array<string>;
  createdOn: number;
  timeLimit?: number;
  bwsJoinSecret?: string;
  __v: number;


  /**
   * Create a new TssKeyGenModel instance. This is used to create a new TSS keygen session.
   */
  static create(params: {
    /** Session ID */
    id: string;
    /** Initial broadcast message from party 0 */
    message: ITssKeyMessageObject;
    /** Number of key participants */
    n: number;
    /** Copayer ID of party 0 */
    copayerId: string;
    /** Password hash for joining the session */
    passwordHash?: string;
    /** TSS keygen version */
    version: number;
    /** Time limit for the session in minutes, after which the session expires */
    timeLimit?: number;
  }): TssKeyGenModel {
    const { id, message, n, copayerId, passwordHash, version } = params;
    const { partyId } = message;
    const timeLimit = Number(params.timeLimit);
    $.checkArgument(partyId === 0, 'Key generation session must be started by partyId 0');
    $.checkArgument(!timeLimit || (Number.isFinite(timeLimit) && timeLimit > 0), 'Time limit must be a positive number');

    const x = new TssKeyGenModel();
    x.id = id;
    x.schemeVersion = version || Defaults.TSS_KEYGEN_SCHEME_VERSION;
    x.n = n;
    x.participants = new Array(n);
    x.participants[partyId] = copayerId;
    x.rounds = [[{
      fromPartyId: partyId,
      messages: message
    }]];
    x.joinPassword = passwordHash;
    x.keyShares = new Array(n);
    x.createdOn = Date.now();
    x.timeLimit = Math.min(timeLimit || Defaults.TSS_KEYGEN_TIME_LIMIT, 60) * 60 * 1000; // capped at 60 minutes
    x.__v = 0;
    return x;
  }

  static fromObj(obj: ITssKeyGenModel & { __v: number }): TssKeyGenModel {
    const x = new TssKeyGenModel();
    x.id = obj.id;
    x.schemeVersion = obj.schemeVersion;
    x.n = obj.n;
    x.participants = obj.participants;
    x.rounds = obj.rounds;
    x.sharedPublicKey = obj.sharedPublicKey;
    x.joinPassword = obj.joinPassword;
    x.keyShares = obj.keyShares;
    x.createdOn = obj.createdOn;
    x.timeLimit = obj.timeLimit;
    x.bwsJoinSecret = obj.bwsJoinSecret;
    x.__v = obj.__v;
    return x;
  }

  getCurrentRound(): number {
    const mostRecentRound = this.rounds.length - 1;
    if (this.rounds[mostRecentRound].length === this.n) {
      // If the most recent round is done, return the next round
      return mostRecentRound + 1;
    }
    return mostRecentRound;
  }
}
