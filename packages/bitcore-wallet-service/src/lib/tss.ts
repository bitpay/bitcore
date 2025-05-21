import BitcoreLib from 'bitcore-lib';
import { Errors } from './errors/errordefinitions'
import logger from './logger';
import { ITssKeyMessageObject, TssKeyGenModel } from './model/tsskeygen';
import { ITssSigMessageObject, TssSigGenModel } from './model/tsssign';
import { checkRequired, WalletService } from './server';
import { Storage } from './storage';

class TssKeyGenClass {
   async getMessagesForParty(params: { id: string; round: number | string; copayerId: string; }): Promise<{ messages?: ITssKeyMessageObject[]; publicKey?: string; }> {
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

    if (session.sharedPublicKey) {
      return { publicKey: session.sharedPublicKey };
    }

    const otherPartyMsgs = session.rounds[round].filter(m => m.fromPartyId != partyId);
    if (otherPartyMsgs.length === session.n - 1) {
      const messages = otherPartyMsgs.map(m => m.messages);
      for (const m of messages) {
        m.p2pMessages = m.p2pMessages.filter(m => m.to == partyId);
      }
      return { messages, publicKey: session.sharedPublicKey };
    }
    return {};
  }

  async processMessage(params: { id: string; message: ITssKeyMessageObject; copayerId: string; }) {
    const { id, message, copayerId } = params;
    if (!id || typeof id !== 'string') {
      throw Errors.TSS_GENERIC_ERROR.withMessage('Invalid id provided: ' + id);
    }
    if (typeof copayerId !== 'string') {
      throw Errors.TSS_GENERIC_ERROR.withMessage('Invalid copayerId provided: ' + copayerId);
    }

    const storage = WalletService.getStorage();
    let session = await storage.fetchTssKeyGenSession({ id });

    if (session) {
      if (!this._isValidBroadcastMessage({ message }) && !this._isValidP2pMessage({ message })) {
        throw Errors.TSS_INVALID_MESSAGE.withMessage('Invalid message provided');
      }

      if (!session.participants[message.partyId]) {
        if (!this._checkPassword({ session, message })) {
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
      await this._initSession({ id, message, storage, copayerId });
    } else {
      throw Errors.TSS_SESSION_NOT_FOUND;
    }
  }

  private _checkPassword(params: { session: TssKeyGenModel; message: ITssKeyMessageObject & { password?: string } }) {
    const { session, message } = params;
    if (!session.joinPassword) {
      return true;
    }
    if (!message.password) {
      return false;
    }
    const passwordHash = BitcoreLib.crypto.Hash.sha256(Buffer.from(session.id + message.password)).toString('hex');
    return session.joinPassword === passwordHash;
  }

  private _isValidBroadcastMessage(params: { message: ITssKeyMessageObject }) {
    const { message } = params;
    return typeof message?.broadcastMessages?.[0]?.from === 'number' &&
      typeof message?.broadcastMessages?.[0]?.payload?.message === 'string' &&
      typeof message?.broadcastMessages?.[0]?.payload?.signature === 'string';
  }

  private _isValidP2pMessage(params: { message: ITssKeyMessageObject }) {
    const { message } = params;
    return typeof message?.p2pMessages?.[0]?.from === 'number' &&
      typeof message?.p2pMessages?.[0]?.to === 'number' &&
      typeof message?.p2pMessages?.[0]?.payload?.encryptedMessage === 'string' &&
      typeof message?.p2pMessages?.[0]?.payload?.signature === 'string' &&
      typeof message?.p2pMessages?.[0]?.commitment === 'string';
  }

  private async _initSession(params: { id: string; message: ITssKeyMessageObject & { n?: number | string; password?: string }; storage: Storage; copayerId: string; }) {
    const { id, message, storage, copayerId } = params;
    const n = parseInt(message.n as string);
    if (!n || n < 1) {
      throw Errors.TSS_GENERIC_ERROR.withMessage('Invalid n provided: ' + n);
    }

    let passwordHash: string = null;
    if (message.password) {
      passwordHash = BitcoreLib.crypto.Hash.sha256(Buffer.from(id + message.password)).toString('hex');
    }
    
    delete message.n;
    delete message.password;
    
    const doc = TssKeyGenModel.create({
      id,
      message,
      n,
      copayerId,
      passwordHash
    });
    const result = await storage.storeTssKeyGenSession({ doc });
    if (!result.result.ok) {
      logger.error('Failed to store a new TSS key generation session %o %o', id, result);
      throw Errors.TSS_GENERIC_ERROR.withMessage('Failed to store TSS key generation session');
    }
  }

  private async _pushMessage(params: { id: string; session: TssKeyGenModel; message: ITssKeyMessageObject; storage: Storage; }) {
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

  async storePublicKey(params: { id: string; message: Partial<ITssKeyMessageObject>; }) {
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

    const result = await storage.storeTssKeySharedPubKey({ id, publicKey });
    if (!result.result.ok) {
      logger.error('Failed to store TSS key generation public key %o %o', id, result);
      throw Errors.TSS_GENERIC_ERROR.withMessage('Failed to store TSS key generation public key');
    }
  }
};

export const TssKeyGen = new TssKeyGenClass();

class TssSignClass {
  async getMessagesForParty(params: { id: string; round: number | string; copayerId: string; }): Promise<{ messages?: ITssSigMessageObject[]; signature?: ITssSigMessageObject['signature']; }> {
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

    if (session.signature) {
      return { signature: session.signature };
    }

    const otherPartyMsgs = session.rounds[round].filter(m => m.fromPartyId != party.partyId);
    if (otherPartyMsgs.length === session.m - 1) {
      const messages = otherPartyMsgs.map(m => m.messages);
      for (const m of messages) {
        m.p2pMessages = m.p2pMessages.filter(m => m.to == party.partyId);
      }
      return { messages, signature: session.signature };
    }
    return {};
  }

  async processMessage(params: { id: string; message: ITssSigMessageObject; copayerId: string; }) {
    const { id, message, copayerId } = params;
    if (!id || typeof id !== 'string') {
      throw Errors.TSS_GENERIC_ERROR.withMessage('Invalid id provided: ' + id);
    }
    if (typeof copayerId !== 'string') {
      throw Errors.TSS_GENERIC_ERROR.withMessage('Invalid copayerId provided: ' + copayerId);
    }

    const storage = WalletService.getStorage();
    let session = await storage.fetchTssSigSession({ id });

    if (session) {
      if (!this._isValidBroadcastMessage({ message }) && !this._isValidP2pMessage({ message })) {
        throw Errors.TSS_INVALID_MESSAGE.withMessage('Invalid message provided');
      }
  
      const isParticipant = !!session.participants.find(p => p.copayerId === copayerId && p.partyId === message.partyId);
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
        if (!result) {
          session = await storage.fetchTssSigSession({ id });
        }
      }
    } else if (message.round === 0) {
      if (!this._isValidBroadcastMessage({ message })) {
        throw Errors.TSS_INVALID_MESSAGE.withMessage('Invalid broadcast message provided');
      }  
      await this._initSession({ id, message, storage, copayerId });
    } else {
      throw Errors.TSS_SESSION_NOT_FOUND;
    }
  }

  private _isValidBroadcastMessage(params: { message: ITssSigMessageObject }) {
    const { message } = params;
    return typeof message?.broadcastMessages?.[0]?.from === 'number' &&
      typeof message?.broadcastMessages?.[0]?.payload?.message === 'string' &&
      typeof message?.broadcastMessages?.[0]?.payload?.signature === 'string';
  }

  private _isValidP2pMessage(params: { message: ITssSigMessageObject }) {
    const { message } = params;
    return typeof message?.p2pMessages?.[0]?.from === 'number' &&
      typeof message?.p2pMessages?.[0]?.to === 'number' &&
      typeof message?.p2pMessages?.[0]?.payload?.encryptedMessage === 'string' &&
      typeof message?.p2pMessages?.[0]?.payload?.signature === 'string';
  }

  private async _initSession(params: { id: string; message: ITssSigMessageObject & { m?: number | string }; storage: Storage; copayerId: string; }) {
    const { id, message, storage, copayerId } = params;
    const m = parseInt(message.m as string);
    if (!m || m < 1) {
      throw Errors.TSS_GENERIC_ERROR.withMessage('Invalid m provided: ' + m);
    }
    delete message.m;
    const doc = TssSigGenModel.create({
      id,
      message,
      m,
      copayerId
    });
    const result = await storage.storeTssSigSession({ doc });
    if (!result.result.ok) {
      logger.error('Failed to store a new TSS sig generation session %o %o', id, result);
      throw Errors.TSS_GENERIC_ERROR.withMessage('Failed to store TSS sig generation session');
    }
  }

  private async _pushMessage(params: { id: string; session: TssSigGenModel; message: ITssSigMessageObject; storage: Storage; }) {
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

  async storeSignature(params: { id: string; message: Partial<ITssSigMessageObject>; }) {
    const { id, message } = params;
    const { signature } = message;
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

    const result = await storage.storeTssSignature({ id, signature: {
      r: signature.r,
      s: signature.s,
      v: signature.v,
      pubKey: signature.pubKey,
    }});
    if (!result.result.ok) {
      logger.error('Failed to store TSS signature %o %o', id, result);
      throw Errors.TSS_GENERIC_ERROR.withMessage('Failed to store TSS signature');
    }
  }
};

export const TssSign = new TssSignClass();