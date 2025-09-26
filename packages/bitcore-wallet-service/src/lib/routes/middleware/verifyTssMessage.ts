import { utils as tssUtils } from 'bitcore-tss';
import { Errors } from '../../errors/errordefinitions';
import { ITssKeyMessageObject } from '../../model/tsskeygen';
import { ITssSigMessageObject } from '../../model/tsssign';


export async function verifyTssMessage(req, res, next) {
  try {
    const { message }: { message: ITssKeyMessageObject | ITssSigMessageObject } = req.body
    const { publicKey } = message || {};
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
      // Note: We can't verify individual p2p messages any more than this.
      //  `m.payload.signature` is for the unencrypted message.
      //  Only the recipients can verify on the client side.
      if (!m.payload || !m.payload.encryptedMessage || !m.payload.signature) {
        return res.status(400).send(Errors.TSS_INVALID_MESSAGE_SIG);
      }
    }
    return next();
  } catch (err) {
    return res.status(400).send(Errors.TSS_INVALID_MESSAGE);
  }
};

