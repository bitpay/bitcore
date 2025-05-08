import { utils as tssUtils } from 'bitcore-tss';
import { Errors } from '../../errors/errordefinitions';
import { ITssKeyMessageObject } from '../../model/tsskeygen';
import { ITssSigMessageObject } from '../../model/tsssign';


export async function verifyTssMessage(req, res, next) {
  try {
    // TODO do some more validation here?
    // Do we want to (can we?) verify p2p messages?

    const message: ITssKeyMessageObject | ITssSigMessageObject = req.body
    const { publicKey } = message;
    if (!publicKey) {
      return res.status(400).send(Errors.TSS_PUBKEY_MISSING);
    }

    if (!message.broadcastMessages?.length && !message.p2pMessages?.length) {
      return res.status(400).send(Errors.TSS_INVALID_MESSAGE);
    }

    for (const m of message.broadcastMessages) {
      if (!tssUtils.verifySignedData(m.payload, publicKey)) {
        return res.status(400).send(Errors.TSS_INVALID_MESSAGE_SIG);
      };
    }
    for (const m of message.p2pMessages) {
      if (!m.payload || !m.payload.encryptedMessage || !m.payload.signature) {
        return res.status(400).send(Errors.TSS_INVALID_MESSAGE_SIG);
      }
    }
    return next();
  } catch (err) {
    return res.status(400).send(Errors.TSS_INVALID_MESSAGE);
  }
};

