import bitcoreLib from 'bitcore-lib';
import * as ECIES from '../ecies/index.js';

export function detachSignData(data, privateKey) {
  const hashdata = bitcoreLib.crypto.Hash.sha256sha256(data);
  const signature = bitcoreLib.crypto.ECDSA.sign(hashdata, privateKey);
  return {
    message: data.toString('base64'),
    signature: signature.toString(),
  };
};

export function verifySignedData(payload, publicKey) {
  const hashdata = bitcoreLib.crypto.Hash.sha256sha256(Buffer.from(payload.message, 'base64'));
  const signature = bitcoreLib.crypto.Signature.fromString(payload.signature);
  publicKey = new bitcoreLib.PublicKey(publicKey);
  return bitcoreLib.crypto.ECDSA.verify(hashdata, signature, publicKey);
};

export function encrypt(data, publicKey, authKey) {
  const encryptedMessageBuffer = ECIES.encrypt({
    message: data,
    publicKey,
    privateKey: authKey,
    opts: { noKey: true },
  });
  return encryptedMessageBuffer;
};

export function decrypt(data, publicKey, authKey) {
  const decryptedMessageBuffer = ECIES.decrypt({
    payload: data,
    privateKey: authKey,
    publicKey,
  });
  return decryptedMessageBuffer;
};

export function encryptAndDetachSignData(data, publicKey, authKey) {
  const encryptedMessage = encrypt(data, publicKey, authKey);
  const signature = detachSignData(data, authKey);
  return {
    encryptedMessage: encryptedMessage.toString('base64'),
    signature: signature.signature,
  };
};

export function decryptAndVerifySignedData(data, publicKey, authKey) {
  const decryptedMessage = decrypt(Buffer.from(data.encryptedMessage, 'base64'), publicKey, authKey).toString('base64');
  const signed = verifySignedData({ message: decryptedMessage, signature: data.signature }, publicKey);
  if (!signed) {
    throw Error('Failed to verify decrypted message');
  }
  return decryptedMessage;
};