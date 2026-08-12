import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { Constants } from './common/constants';
import { Errors } from './errors/errordefinitions';
import logger from './logger';
import { ITssKeyMessageObject, TssKeyGenModel } from './model/tsskeygen';
import { ITssSigMessageObject, TssSigGenModel } from './model/tsssign';
import { WalletService, checkRequired } from './server';
import { Storage } from './storage';

class TssKeyGenClass {
  /**
   * Get messages for a given party in a TSS keygen session.
   * Only returns messages if all other parties have sent their messages for the round.
   */
  async getMessagesForParty(params: {
    /** Session ID */
    id: string;
    /** Round number */
    round: number;
    /** Copayer ID of the requesting party */
    copayerId: string;
  }): Promise<{
    messages?: ITssKeyMessageObject[];
    publicKey?: string;
    hasKeyBackup?: boolean;
  }> {
    const { id, round, copayerId } = params;
    
    const storage = WalletService.getStorage();
    const session = await storage.fetchTssKeyGenSession({ id });
    if (!session) {
      throw Errors.TSS_SESSION_NOT_FOUND;
    }
    if (!session.rounds[round]) {
      return {};
    }

    const partyId = session.participants.indexOf(copayerId);
    if (partyId === -1) {
      throw Errors.TSS_NON_PARTICIPANT;
    }

    const otherPartyMsgs = session.rounds[round].filter(m => m.fromPartyId != partyId);
    // Only return message if all other parties have sent their messages.
    // This is to prevent complexity in TSS session management when processing rounds. There's
    //   no value in partially processing rounds with missing messages and messages can't be
    //   re-processed, so it makes sense to only return messages when the round is complete.
    if (otherPartyMsgs.length !== session.n - 1) {
      return {};
    }

    const messages = otherPartyMsgs.map(m => m.messages);
    for (const m of messages) {
      m.p2pMessages = m.p2pMessages.filter(m => m.to == partyId);
    }
    return { messages, publicKey: session.sharedPublicKey, hasKeyBackup: !!session.keyShares?.[partyId] };
  }

  /**
   * Process a TSS keygen message. This will create a new session if the message is from party 0 and is for round 0.
   */
  async processMessage(params: {
    /** Session ID */
    id: string;
    /** Submitted message to send to others */
    message: ITssKeyMessageObject;
    /** Number of participants (only required for the initial message from party 0) */
    n?: string | number;
    /** Password for the session */
    password?: string;
    /** Copayer ID of the submitting party */
    copayerId: string;
    /** TSS keygen version */
    version: number;
  }): Promise<void> {
    const { id, message, n, password, copayerId } = params;
    if (!id || typeof id !== 'string') {
      throw Errors.TSS_GENERIC_ERROR.withMessage('Invalid id provided: ' + id);
    }
    if (!copayerId || typeof copayerId !== 'string') {
      throw Errors.TSS_GENERIC_ERROR.withMessage('Invalid copayerId provided: ' + copayerId);
    }

    // version was not given by client until 1.1, so fallback to 1.0
    const version = Number(params.version || 1.0);
    if (version < Constants.TSS_SIGGEN_SCHEME_MIN_SERVER_VERSION) {
      throw Errors.UPGRADE_NEEDED;
    }
    if (version > Constants.TSS_SIGGEN_SCHEME_VERSION_MAX) {
      throw Errors.UPGRADE_NEEDED.withMessage('TSS version too new: ' + version);
    }

    const storage = WalletService.getStorage();
    let session = await storage.fetchTssKeyGenSession({ id });

    if (session) {
      if (!this._isValidBroadcastMessage({ message }) && !this._isValidP2pMessage({ message })) {
        throw Errors.TSS_INVALID_MESSAGE.withMessage('Invalid message provided');
      }

      if (session.schemeVersion != version) {
        throw Errors.TSS_MISMATCH_VERSION.withMessage(`TSS version (${version}) does not match session version (${session.schemeVersion})`);
      }


      if (!session.participants[message.partyId]) {
        if (!this._checkPassword({ session, password })) {
          throw Errors.TSS_INVALID_PASSWORD;
        }
        await storage.storeTssKeyGenParticipant({ id, partyId: message.partyId, copayerId });
      }

      let result = false;
      while (!result) {
        result = await this._pushMessage({ id, session, message, storage });
        if (!result) {
          session = await storage.fetchTssKeyGenSession({ id });
        }
      }
    } else if (message.round === 0 && message.partyId === 0) {
      if (!this._isValidBroadcastMessage({ message })) {
        throw Errors.TSS_INVALID_MESSAGE.withMessage('Invalid broadcast message provided');
      }
      await this._initSession({ id, message, n, password, storage, copayerId, version });
    } else {
      throw Errors.TSS_SESSION_NOT_FOUND;
    }
  }

  /**
   * Check the password for a TSS keygen session. Returns true if the password is valid or if no password is set for the session.
   */
  private _checkPassword(params: {
    /** TSS keygen session fetched from BWS storage */
    session: TssKeyGenModel;
    /** Password to check */
    password: string;
  }): boolean {
    const { session, password } = params;
    if (!session.joinPassword) {
      return true;
    }
    if (!password) {
      return false;
    }
    const passwordHash = BitcoreLib.crypto.Hash.sha256(Buffer.from(session.id + password)).toString('hex');
    return session.joinPassword === passwordHash;
  }

  /** Validate if the message is a valid broadcast message */
  private _isValidBroadcastMessage(params: { message: ITssKeyMessageObject }) {
    const { message } = params;
    return typeof message?.broadcastMessages?.[0]?.from === 'number' &&
      typeof message?.broadcastMessages?.[0]?.payload?.message === 'string' &&
      typeof message?.broadcastMessages?.[0]?.payload?.signature === 'string';
  }

  /** Validate if the message is a valid P2P message */
  private _isValidP2pMessage(params: { message: ITssKeyMessageObject }) {
    const { message } = params;
    return typeof message?.p2pMessages?.[0]?.from === 'number' &&
      typeof message?.p2pMessages?.[0]?.to === 'number' &&
      typeof message?.p2pMessages?.[0]?.payload?.encryptedMessage === 'string' &&
      typeof message?.p2pMessages?.[0]?.payload?.signature === 'string' &&
      typeof message?.p2pMessages?.[0]?.commitment === 'string';
  }

  /** Initialize a new TSS keygen session */
  private async _initSession(params: {
    /** Session ID */
    id: string;
    /** Broadcast message from party 0 */
    message: ITssKeyMessageObject;
    /** Number of participants */
    n: number | string;
    /** Password needed to join the session */
    password?: string;
    /** TSS keygen version */
    version: number;
    /** BWS storage instance */
    storage: Storage;
    /** Copayer ID of the submitting party (party 0) */
    copayerId: string;
  }) {
    const { id, message, password, storage, copayerId, version } = params;
    const n = parseInt(params.n as string);
    if (!n || n < 1) {
      throw Errors.TSS_GENERIC_ERROR.withMessage('Invalid n provided: ' + n);
    }

    let passwordHash: string;
    if (password) {
      passwordHash = BitcoreLib.crypto.Hash.sha256(Buffer.from(id + password)).toString('hex');
    }
    
    const doc = TssKeyGenModel.create({
      id,
      message,
      n,
      copayerId,
      passwordHash,
      version: version || 1.0 // Initial version of TSS keygen was 1.0, but BWC didn't pass it in
    });
    const result = await storage.storeTssKeyGenSession({ doc });
    if (!result.result.ok) {
      logger.error('Failed to store a new TSS key generation session %o %o', id, result);
      throw Errors.TSS_GENERIC_ERROR.withMessage('Failed to store TSS key generation session');
    }
  }

  /**
   * Push a TSS keygen message to the session.
   * This will fail if the round is already complete or if the message is from a party that has already sent a message for the round.
   */
  private async _pushMessage(params: {
    /** Session ID */
    id: string;
    /** TSS keygen session fetched from BWS storage */
    session: TssKeyGenModel;
    /** Message to push to the session */
    message: ITssKeyMessageObject;
    /** BWS storage instance */
    storage: Storage;
  }) {
    const { id, session, message, storage } = params;
    const { round } = message;

    const currentRound = session.getCurrentRound();
    if (round < currentRound) {
      throw Errors.TSS_ROUND_ALREADY_DONE;
    } else if (round > currentRound) {
      throw Errors.TSS_ROUND_TOO_EARLY;
    }

    const existing = (session.rounds[currentRound] || []).find(m => m.fromPartyId === message.partyId);
    if (existing) {
      throw Errors.TSS_ROUND_MESSAGE_EXISTS;
    }

    try {
      const result = await storage.storeTssKeyGenMessage({ id, message, __v: session.__v });
      if (!result.result.ok) {
        logger.error('Failed to store TSS key generation message %o %o %o', id, result, message);
        throw Errors.TSS_GENERIC_ERROR.withMessage('Failed to store TSS key generation message');
      }
      return true;
    } catch (e) {
      if (e?.message?.startsWith('MONGO_DOC_OUTDATED')) {
        return false;
      }
      throw e;
    }
  }

  /** Save the generated public key to the TSS keygen session */
  async storeKey(params: {
    id: string;
    message: {
      publicKey: ITssKeyMessageObject['publicKey'];
      /** Unused - removed support for saving keychain */
      encryptedKeyChain: string;
    };
    /** Unused - only needed for storing the encryptedKeyChain */
    copayerId: string;
  }) {
    const { id, message } = params;
    const { publicKey } = message;
    if (!publicKey) {
      throw Errors.TSS_GENERIC_ERROR.withMessage('No public key provided');
    }
    const storage = WalletService.getStorage();
    const session = await storage.fetchTssKeyGenSession({ id });

    if (!session) {
      throw Errors.TSS_SESSION_NOT_FOUND;
    }

    if (!session.sharedPublicKey) {
      const result = await storage.storeTssKeySharedPubKey({ id, publicKey });

      if (!result.result.ok) {
        logger.error('Failed to store TSS key generation public key %o %o', id, result);
        throw Errors.TSS_GENERIC_ERROR.withMessage('Failed to store TSS key generation public key');
      }
    }

    /**
     * 2026-03-10:
     *  Removing this feature until we decide to support keychain backup to our DB (probably never).
     *  If we ever decide to do this, we may need to add support in BWC for restoring it.
     */

    // if (encryptedKeyChain) {
    //   const partyId = session.participants.indexOf(copayerId);
    //   const result = await storage.storeTssKeyShare({ id, partyId, encryptedKeyChain });

    //   if (!result.result.ok) {
    //     logger.error('Failed to store TSS key generation public key %o %o', id, result);
    //     throw Errors.TSS_GENERIC_ERROR.withMessage('Failed to store TSS key generation public key');
    //   }
    // }
  }

  /** Store the BWS join secret for the TSS keygen session */
  async storeBwsJoinSecret(params: {
    /** Session ID */
    id: string;
    /** BWS join secret */
    secret: string;
    /** Copayer ID of the submitting party (must be the session creator) */
    copayerId: string;
  }) {
    const { id, secret, copayerId } = params;
    if (!secret) {
      throw Errors.TSS_GENERIC_ERROR.withMessage('No BWS join secret provided');
    }
    if (typeof secret !== 'string') {
      throw Errors.TSS_GENERIC_ERROR.withMessage('Invalid BWS join secret provided');
    }
    const storage = WalletService.getStorage();
    const session = await storage.fetchTssKeyGenSession({ id });

    if (!session) {
      throw Errors.TSS_SESSION_NOT_FOUND;
    }

    if (session.participants.indexOf(copayerId) !== 0) {
      throw Errors.TSS_GENERIC_ERROR.withMessage('Only the session creator can store the BWS join secret');
    }

    const result = await storage.storeTssKeyBwsJoinSecret({ id, secret });
    if (!result.result.ok) {
      logger.error('Failed to store TSS key generation BWS join secret %o %o', id, result);
      throw Errors.TSS_GENERIC_ERROR.withMessage('Failed to store TSS key generation BWS join secret');
    }
  }

  /** Get the BWS join secret for the TSS keygen session */
  async getBwsJoinSecret(params: {
    /** Session ID */
    id: string;
    /** Copayer ID of the requesting party */
    copayerId: string;
  }): Promise<string> {
    const { id, copayerId } = params;
    const storage = WalletService.getStorage();
    const session = await storage.fetchTssKeyGenSession({ id });
    if (!session) {
      throw Errors.TSS_SESSION_NOT_FOUND;
    }
    if (session.participants.indexOf(copayerId) === -1) {
      throw Errors.TSS_NON_PARTICIPANT;
    }
    if (!session.bwsJoinSecret) {
      throw Errors.TSS_BWS_JOIN_SECRET_NOT_FOUND;
    }
    return session.bwsJoinSecret;
  }
};

export const TssKeyGen = new TssKeyGenClass();

class TssSignClass {
  /**
   * Get messages for a given party in a TSS signature session.
   * Only returns messages if all other parties have sent their messages for the round.
   */
  async getMessagesForParty(params: {
    /** Session ID */
    id: string;
    /** Round number */
    round: number;
    /** Copayer ID of the requesting party */
    copayerId: string;
  }): Promise<{ messages?: ITssSigMessageObject[]; signature?: ITssSigMessageObject['signature']; participants?: string[] }> {
    const { id, round, copayerId } = params;

    const storage = WalletService.getStorage();
    const session = await storage.fetchTssSigSession({ id });
    if (!session) {
      throw Errors.TSS_SESSION_NOT_FOUND;
    }
    if (!session.rounds[round]) {
      return {};
    }

    const party = session.participants.find(p => p.copayerId === copayerId);
    if (!party) {
      throw Errors.TSS_NON_PARTICIPANT;
    }

    const otherPartyMsgs = session.rounds[round].filter(m => m.fromPartyId != party.partyId);
    const participants = otherPartyMsgs.map(m => {
      const p = session.participants.find(p => p.partyId === m.fromPartyId);
      return p?.copayerId;
    }).filter(Boolean) as string[];

    if (otherPartyMsgs.length === session.m - 1) {
      const messages = otherPartyMsgs.map(m => m.messages);
      for (const m of messages) {
        m.p2pMessages = m.p2pMessages.filter(m => m.to == party.partyId);
      }
      return { messages, signature: session.signature, participants };
    }
    return { participants };
  }

  /**
   * Process a TSS signature message. This will create a new session if the message is from party 0 and is for round 0.
   */
  async processMessage(params: {
    /** Session ID */
    id: string;
    /** Submitted message to send to others */
    message: ITssSigMessageObject;
    /** Number of signers (only required for the initial message from party 0) */
    m?: string | number;
    /** Copayer ID of the sender */
    copayerId: string;
    /** TSS sig generation version */
    version: number;
  }) {
    const { id, message, m, copayerId } = params;
    if (!id || typeof id !== 'string') {
      throw Errors.TSS_GENERIC_ERROR.withMessage('Invalid id provided: ' + id);
    }
    if (typeof copayerId !== 'string') {
      throw Errors.TSS_GENERIC_ERROR.withMessage('Invalid copayerId provided: ' + copayerId);
    }

    // version was not given by client until 1.1, so fallback to 1.0
    const version = Number(params.version || 1.0);
    if (version < Constants.TSS_SIGGEN_SCHEME_MIN_SERVER_VERSION) {
      throw Errors.UPGRADE_NEEDED;
    }
    if (version > Constants.TSS_SIGGEN_SCHEME_VERSION_MAX) {
      throw Errors.UPGRADE_NEEDED.withMessage('TSS version too new: ' + version);
    }

    const storage = WalletService.getStorage();
    let session = await storage.fetchTssSigSession({ id });

    if (session) {
      if (!this._isValidBroadcastMessage({ message }) && !this._isValidP2pMessage({ message })) {
        throw Errors.TSS_INVALID_MESSAGE.withMessage('Invalid message provided');
      }

      if (session.schemeVersion != version) {
        throw Errors.TSS_MISMATCH_VERSION.withMessage(`TSS version (${version}) does not match session version (${session.schemeVersion})`);
      }
  
      const isParticipant = session.participants.some(p => p.copayerId === copayerId && p.partyId === message.partyId);
      if (!isParticipant) {
        if (session.participants.length === session.m) {
          throw Errors.TSS_MAX_PARTICIPANTS_REACHED;
        }
        try {
          await storage.storeTssSigParticipant({ id, partyId: message.partyId, copayerId, __v: session.__v });
        } catch (e) {
          if (e?.message?.startsWith('MONGO_DOC_OUTDATED')) {
            return this.processMessage(params);
          }
          throw e;
        }
      }

      let result = false;
      while (!result) {
        result = await this._pushMessage({ id, session, message, storage });
        // `result` will be false if the session was stale (version conflict) and we need to retry
        // Any other failure of the message state will result in a throw (e.g. same-message race condition, round already done, etc.)
        if (!result) {
          session = await storage.fetchTssSigSession({ id });
        }
      }
    } else if (message.round === 0) {
      if (!this._isValidBroadcastMessage({ message })) {
        throw Errors.TSS_INVALID_MESSAGE.withMessage('Invalid broadcast message provided');
      }  
      await this._initSession({ id, message, m, storage, copayerId, version });
    } else {
      throw Errors.TSS_SESSION_NOT_FOUND;
    }
  }

  /** Checks if a broadcast message is in a valid format */
  private _isValidBroadcastMessage(params: { message: ITssSigMessageObject }): boolean {
    const { message } = params;
    return typeof message?.broadcastMessages?.[0]?.from === 'number' &&
      typeof message?.broadcastMessages?.[0]?.payload?.message === 'string' &&
      typeof message?.broadcastMessages?.[0]?.payload?.signature === 'string';
  }

  /** Checks if a P2P message is in a valid format */
  private _isValidP2pMessage(params: { message: ITssSigMessageObject }): boolean {
    const { message } = params;
    return typeof message?.p2pMessages?.[0]?.from === 'number' &&
      typeof message?.p2pMessages?.[0]?.to === 'number' &&
      typeof message?.p2pMessages?.[0]?.payload?.encryptedMessage === 'string' &&
      typeof message?.p2pMessages?.[0]?.payload?.signature === 'string';
  }

  /**
   * Initialize a new TSS signature session. This is only called when the first message from party 0 for round 0 is received.
   */
  private async _initSession(params: {
    /** Session ID */
    id: string;
    /** Initial broadcast message by party 0 */
    message: ITssSigMessageObject;
    /** Number of signers */
    m: number | string;
    /** BWS storage instance */
    storage: Storage;
    /** Party 0's copayer ID */
    copayerId: string;
    /** TSS sig generation version given by client to ensure compatibility with others */
    version: number;
  }): Promise<void> {
    const { id, message, storage, copayerId, version } = params;
    const m = parseInt(params.m as string);
    if (!m || m < 1) {
      throw Errors.TSS_GENERIC_ERROR.withMessage('Invalid m provided: ' + m);
    }
    const doc = TssSigGenModel.create({
      id,
      message,
      m,
      copayerId,
      version
    });
    const result = await storage.storeTssSigSession({ doc });
    if (!result.result.ok) {
      logger.error('Failed to store a new TSS sig generation session %o %o', id, result);
      throw Errors.TSS_GENERIC_ERROR.withMessage('Failed to store TSS sig generation session');
    }
  }

  /**
   * Push a TSS signature message to the session.
   */
  private async _pushMessage(params: {
    /** Session ID */
    id: string;
    /** TSS sig generation session fetched from BWS storage */
    session: TssSigGenModel;
    /** TSS signature message to be pushed */
    message: ITssSigMessageObject;
    /** BWS storage instance */
    storage: Storage;
  }): Promise<boolean> {
    const { id, session, message, storage } = params;
    const { round } = message;

    const currentRound = session.getCurrentRound();
    if (round < currentRound) {
      throw Errors.TSS_ROUND_ALREADY_DONE;
    } else if (round > currentRound) {
      throw Errors.TSS_ROUND_TOO_EARLY;
    }

    const existing = (session.rounds[currentRound] || []).find(m => m.fromPartyId === message.partyId);
    if (existing) {
      throw Errors.TSS_ROUND_MESSAGE_EXISTS;
    }

    try {
      const result = await storage.storeTssSigMessage({ id, message, __v: session.__v });
      if (!result.result.ok) {
        logger.error('Failed to store TSS key generation message %o %o %o', id, result, message);
        throw Errors.TSS_GENERIC_ERROR.withMessage('Failed to store TSS key generation message');
      }
      return true;
    } catch (e) {
      if (e?.message?.startsWith('MONGO_DOC_OUTDATED')) {
        return false;
      }
      throw e;
    }
  }

  /**
   * Stores the signature to the session
  */
  async storeSignature(params: {
    /** Session ID */
    id: string;
    /** Signature to store */
    signature: ITssSigMessageObject['signature'];
  }): Promise<void> {
    const { id, signature } = params;
    if (!signature) {
      throw Errors.TSS_NO_FINAL_SIGNATURE;
    }
    if (!checkRequired(signature, ['r', 's', 'v', 'pubKey'])) {
      throw Errors.TSS_INVALID_FINAL_SIGNATURE;
    }
    const storage = WalletService.getStorage();
    const session = await storage.fetchTssSigSession({ id });

    if (!session) {
      throw Errors.TSS_SESSION_NOT_FOUND;
    }

    if (!session.signature) {
      const result = await storage.storeTssSignature({ id, signature: {
        r: signature.r,
        s: signature.s,
        v: signature.v,
        pubKey: signature.pubKey,
      } });
      if (!result.result.ok) {
        logger.error('Failed to store TSS signature %o %o', id, result);
        throw Errors.TSS_GENERIC_ERROR.withMessage('Failed to store TSS signature');
      }
    } else if (
      session.signature.r !== signature.r ||
      session.signature.s !== signature.s ||
      session.signature.v !== signature.v ||
      session.signature.pubKey !== signature.pubKey
    ) {
      throw Errors.TSS_FINAL_SIGNATURE_MISMATCH;
    }
  }
};

export const TssSign = new TssSignClass();