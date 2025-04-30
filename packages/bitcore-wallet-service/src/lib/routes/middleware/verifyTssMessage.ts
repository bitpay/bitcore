import { utils as tssUtils } from 'bitcore-tss';
import { Errors } from '../../errors/errordefinitions';
import { ITssKeygenMessageObject } from '../../model/tsskeygen';


export function verifyTssMessage(req, res, next) {
  const message: ITssKeygenMessageObject = req.body
  const { publicKey } = message;
  if (!publicKey) {
    return res.status(400).send(Errors.TSS_KEYGEN_PUBKEY_MISSING);
  }

  for (const m of message.broadcastMessages) {
    if (!tssUtils.verifySignedData(m.payload, publicKey)) {
      return res.status(400).send(Errors.TSS_KEYGEN_INVALID_MESSAGE_SIG);
    };
  }
  for (const m of message.p2pMessages) {
    if (!m.commitment || !m.payload || !m.payload.encryptedMessage || !m.payload.signature) {
      return res.status(400).send(Errors.TSS_KEYGEN_INVALID_MESSAGE_SIG);
    }
  }
  return next();
};

