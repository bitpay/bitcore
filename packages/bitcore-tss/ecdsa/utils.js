const bitcoreLib = require('@bitpay-labs/bitcore-lib');
const ECIES = require('../ecies/ecies');

function detachSignData(data, privateKey) {
  const hashdata = bitcoreLib.crypto.Hash.sha256sha256(data);
  const signature = bitcoreLib.crypto.ECDSA.sign(hashdata, privateKey);
  return {
    message: data.toString('base64'),
    signature: signature.toString(),
  };
};

function verifySignedData(payload, publicKey) {
  const hashdata = bitcoreLib.crypto.Hash.sha256sha256(Buffer.from(payload.message, 'base64'));
  const signature = bitcoreLib.crypto.Signature.fromString(payload.signature);
  publicKey = new bitcoreLib.PublicKey(publicKey);
  return bitcoreLib.crypto.ECDSA.verify(hashdata, signature, publicKey);
};

function encrypt(data, publicKey, authKey) {
  const encryptedMessageBuffer = ECIES.encrypt({
    message: data,
    publicKey,
    privateKey: authKey,
    opts: { noKey: true },
  });
  return encryptedMessageBuffer;
};

function decrypt(data, publicKey, authKey) {
  const decryptedMessageBuffer = ECIES.decrypt({
    payload: data,
    privateKey: authKey,
    publicKey,
  });
  return decryptedMessageBuffer;
};

function encryptAndDetachSignData(data, publicKey, authKey) {
  const encryptedMessage = encrypt(data, publicKey, authKey);
  const signature = detachSignData(data, authKey);
  return {
    encryptedMessage: encryptedMessage.toString('base64'),
    signature: signature.signature,
  };
};

function decryptAndVerifySignedData(data, publicKey, authKey) {
  const decryptedMessage = decrypt(Buffer.from(data.encryptedMessage, 'base64'), publicKey, authKey).toString('base64');
  const signed = verifySignedData({ message: decryptedMessage, signature: data.signature }, publicKey);
  if (!signed) {
    throw Error('Failed to verify decrypted message');
  }
  return decryptedMessage;
};

module.exports.detachSignData = detachSignData;
module.exports.verifySignedData = verifySignedData;
module.exports.encrypt = encrypt;
module.exports.decrypt = decrypt;
module.exports.encryptAndDetachSignData = encryptAndDetachSignData;
module.exports.decryptAndVerifySignedData = decryptAndVerifySignedData;