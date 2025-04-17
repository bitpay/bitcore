import { Errors } from './errors/errordefinitions'
import logger from './logger';
import { ITssKeygenMessageObject, TssKeyGenModel } from './model/tsskeygen';
import { WalletService } from './server';
import { Storage } from './storage';

export async function getMessagesForParty(params: { id: string; round: number | string; copayerId: string; }) {
  const { id, round, copayerId } = params;
  
  const storage = WalletService.getStorage();
  const session = await storage.fetchTssKeygen({ id });
  if (!session) {
    throw Errors.TSS_KEYGEN_SESSION_NOT_FOUND;
  }
  if (!session.rounds[round]) {
    return null;
  }

  const partyId = session.participants.indexOf(copayerId);
  const otherPartyMsgs = session.rounds[round].filter(m => m.fromPartyId != partyId);
  if (otherPartyMsgs.length === session.n - 1) {
    const messages = otherPartyMsgs.map(m => m.messages);
    for (const m of messages) {
      m.p2pMessages = m.p2pMessages.filter(m => m.to == partyId);
    }
    return messages;
  }
  return null;
};

export async function processMessage(params: { id: string; message: ITssKeygenMessageObject; copayerId: string; }) {
  const { id, message, copayerId } = params;

  const storage = WalletService.getStorage();
  let session = await storage.fetchTssKeygen({ id });

  if (session) {
    if (!session.participants[message.partyId]) {
      await storage.storeTssKeygenParticipant({ id, partyId: message.partyId, copayerId });
    }

    let result = false;
    while (!result) {
      result = await _pushMessage({ id, session, message, storage });
      if (!result) {
        session = await storage.fetchTssKeygen({ id });
      }
    }
  } else if (message.round === 0 && message.partyId === 0) {
    await _initSession({ id, message, storage, copayerId });
    const ss = await storage.fetchTssKeygen({ id });
    console.log(ss);
  } else {
    throw Errors.TSS_KEYGEN_SESSION_NOT_FOUND;
  }
};

async function _initSession(params: { id: string; message: ITssKeygenMessageObject & { n?: number }; storage: Storage; copayerId: string; }) {
  const { id, message, storage, copayerId } = params;
  const { n } = message;
  delete message.n;
  const doc = TssKeyGenModel.create({
    id,
    message,
    n,
    copayerId
  });
  const result = await storage.storeTssKeygenNew({ doc });
  if (!result.result.ok) {
    logger.error('Failed to store a new TSS key generation session %o %o', id, result);
    throw Errors.TSS_KEYGEN_GENERIC_ERROR.withMessage('Failed to store TSS key generation session');
  }
};

async function _pushMessage(params: { id: string; session: TssKeyGenModel; message: ITssKeygenMessageObject; storage: Storage; }) {
  const { id, session, message, storage } = params;
  const { round } = message;

  const currentRound = session.getCurrentRound();
  if (round < currentRound) {
    throw Errors.TSS_KEYGEN_ROUND_ALREADY_DONE;
  } else if (round > currentRound) {
    throw Errors.TSS_KEYGEN_ROUND_TOO_EARLY;
  }

  const existing = (session.rounds[currentRound] || []).find(m => m.fromPartyId === message.partyId);
  if (existing) {
    throw Errors.TSS_KEYGEN_ROUND_MESSAGE_EXISTS;
  }

  try {
    const result = await storage.storeTssKeygenMessage({ id, message, __v: session.__v });
    if (!result.result.ok) {
      logger.error('Failed to store TSS key generation message %o %o %o', id, result, message);
      throw Errors.TSS_KEYGEN_GENERIC_ERROR.withMessage('Failed to store TSS key generation message');
    }
    return true;
  } catch (e) {
    if (e?.message?.startsWith('MONGO_DOC_OUTDATED')) {
      return false;
    }
    throw e;
  }
};