import { Common } from '../common';

const { Defaults } = Common;


export interface ITssSigMessageObject {
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
    payload: {
      encryptedMessage: string;
      signature: string;
    };
  }>;
  partyId: number;
  publicKey: string;
  round: number;
  signature?: {
    r: string;
    s: string;
    v: number;
    pubKey: string;
  };
};

export interface ITssSigGenModel {
  /**
   * The ID of the TSS signature generation session.
   */
  id: string;
  /**
   * The version of the BWC/BWS TSS signature generation scheme.
   * This should be incremented any time there are breaking changes to the way
   *  BWC & BWS communicate.
   */
  schemeVersion: number;
  /**
   * The number of required participants in the TSS signature generation process.
   */
  m: number;
  /**
   * The list of public keys of the participants in the TSS signature generation process.
   * The pub keys are in partyId order.
   */
  participants: Array<{
    partyId: number;
    copayerId: string;
  }>;
  /**
   * An array of the rounds in round order. Each round is an array of messages
   */
  rounds: Array<Array<{
    fromPartyId: number;
    messages: ITssSigMessageObject;
  }>>;
  /**
   * The signature generated as the result of the TSS signature generation process.
   * The signature can be generated along a derivation path, which produces a pubKey that's
   *  dfferent from the key gen sharedPublicKey.
   */
  signature?: {
    r: string;
    s: string;
    v: number;
    pubKey: string;
  };
  /**
   * The mongo doc version
   */
  __v: number;
};

export class TssSigGenModel implements ITssSigGenModel {
  id: string;
  m: number;
  participants: Array<{
    partyId: number;
    copayerId: string;
  }>;
  rounds: Array<Array<{
    fromPartyId: number;
    messages: ITssSigMessageObject;
  }>>;
  signature?: ITssSigMessageObject['signature'];
  schemeVersion: number;
  __v: number;


  static create(params: { id: string; message: ITssSigMessageObject; m: number; copayerId: string }): TssSigGenModel {
    const { id, message, m, copayerId } = params;
    const { partyId } = message;

    const x = new TssSigGenModel();
    x.id = id;
    x.schemeVersion = Defaults.TSS_SIGGEN_SCHEME_VERSION;
    x.m = m;
    x.participants = [{
      partyId,
      copayerId
    }];
    x.rounds = [[{
      fromPartyId: partyId,
      messages: message
    }]];
    x.__v = 0;
    return x;
  }

  static fromObj(obj: ITssSigGenModel): TssSigGenModel {
    const x = new TssSigGenModel();
    x.id = obj.id;
    x.schemeVersion = obj.schemeVersion;
    x.m = obj.m;
    x.participants = obj.participants;
    x.rounds = obj.rounds;
    x.signature = obj.signature;
    x.__v = obj.__v;
    return x;
  }

  getCurrentRound(): number {
    const mostRecentRound = this.rounds.length - 1;
    if (this.rounds[mostRecentRound].length === this.m) {
      // If the most recent round is done, return the next round
      return mostRecentRound + 1;
    }
    return mostRecentRound;
  }
}
