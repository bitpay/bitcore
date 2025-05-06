import { utils as tssUtils } from 'bitcore-tss';
import { Errors } from '../../errors/errordefinitions';
import { ITssKeyMessageObject } from '../../model/tsskeygen';
import { ITssSigMessageObject } from '../../model/tsssign';


export function verifyTssMessage(req, res, next) {
  // TODO do some more validation here. Currently, a message with a random pub key and empty message arrays will pass.

  const message: ITssKeyMessageObject | ITssSigMessageObject = req.body
  const { publicKey } = message;
  if (!publicKey) {
    return res.status(400).send(Errors.TSS_PUBKEY_MISSING);
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
};

