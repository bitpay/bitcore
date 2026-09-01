import { utils as tssUtils } from '@bitpay-labs/bitcore-tss';
import { ClientError } from '../../errors/clienterror';
import { Errors } from '../../errors/errordefinitions';
import { error } from '../helpers';
import type { ITssKeyMessageObject } from '../../model/tsskeygen';
import type { ITssSigMessageObject } from '../../model/tsssign';


export async function verifyTssMessage(req, res, next) {
  try {
    const { message }: { message: ITssKeyMessageObject | ITssSigMessageObject } = req.body;
    const { publicKey } = message || {};
    if (!publicKey) {
      throw Errors.TSS_PUBKEY_MISSING;
    }

    if (!message.broadcastMessages?.length && !message.p2pMessages?.length) {
      throw Errors.TSS_INVALID_MESSAGE;
    }

    for (const m of message.broadcastMessages) {
      if (!tssUtils.verifySignedData(m.payload, publicKey)) {
        throw Errors.TSS_INVALID_MESSAGE_SIG;
      };
    }
    for (const m of message.p2pMessages) {
      // Note: We can't verify individual p2p messages any more than this.
      //  `m.payload.signature` is for the unencrypted message.
      //  Only the recipients can verify on the client side.
      if (!m.payload || !m.payload.encryptedMessage || !m.payload.signature) {
        throw Errors.TSS_INVALID_MESSAGE_SIG;
      }
    }
    return next();
  } catch (err) {
    if (err instanceof ClientError) {
      return error.returnError(err, res, req);
    }
    return error.returnError(Errors.TSS_INVALID_MESSAGE, res, req);
  }
};

