import bitcoreLib from 'bitcore-lib';
import ECIES from 'bitcore-ecies';

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
  const ecies = new ECIES({ noKey: true })
    .privateKey(new bitcoreLib.PrivateKey(authKey))
    .publicKey(new bitcoreLib.PublicKey(publicKey));
  const encryptedMessageBuffer = ecies.encrypt(data);
  return encryptedMessageBuffer;
};

export function decrypt(data, publicKey, authKey) {
  const ecies = new ECIES({ noKey: true })
    .privateKey(new bitcoreLib.PrivateKey(authKey))
    .publicKey(new bitcoreLib.PublicKey(publicKey));
  const decryptedMessageBuffer = ecies.decrypt(data);
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