'use strict';

const bitcore = require('bitcore-lib');
const crypto = require('crypto');

const PublicKey = bitcore.PublicKey;
const PrivateKey = bitcore.PrivateKey;
const Hash = bitcore.crypto.Hash;
const $ = bitcore.util.preconditions;


// http://en.wikipedia.org/wiki/Integrated_Encryption_Scheme

function KDF(privateKey, publicKey) {
  const r = privateKey.bn;
  const KB = publicKey.point;
  const P = KB.mul(r);
  const S = P.getX();
  const Sbuf = S.toBuffer({ size: 32 });
  const kEkM = Hash.sha512(Sbuf);
  const kE = kEkM.subarray(0, 32);
  const kM = kEkM.subarray(32, 64);
  return [kE, kM];
};

/**
 * Encrypts the message (String or Buffer) using EC keys.
 * @param {object} params
 * @param {Buffer|string} params.message Message to be encrypted.
 * @param {PublicKey} params.publicKey Receipient's public key is used to encrypt the message.
 * @param {PrivateKey} params.privateKey Your private key is used to sign the payload.
 * @param {Buffer} [params.ivbuf] 16-byte initialization vector (IV) Buffer to be used in AES-CBC.
 *                    By default, `ivbuf` is randomly generated. A specified `ivbuf` is prioritized over opts.deterministicIv.
 * @param {object} [params.opts] Options object. Every field is optional.
 * @param {boolean} [params.opts.noKey] Do not include pubkey in the output.
 * @param {boolean} [params.opts.shortTag] Use 4-byte tag instead of 32-byte. This must be communicated to the payload recipient.
 * @param {boolean} [params.opts.deterministicIv] Compute IV deterministically from message and private key using HMAC-SHA256.
 *                    A deterministic IV enables end-to-end test vectors for alternative implementations.
 *                    Note that identical messages have identical ciphertexts. If it is important to not allow an attacker
 *                    to learn that a message is repeated, then you should leave opts.deterministicIv to false, pass in a custom IV
 *                    with `ivbuf`, or use a salt inside the message.
 * @returns {Buffer} Payload buffer with `pubkey|iv|ciphertext|tag` (pubkey is excluded if `noKey` is given).
 */
function encrypt({ message, publicKey, privateKey, ivbuf, opts = {} }) {
  $.checkArgument(message, 'message is required');
  $.checkArgument(publicKey, 'publicKey is required');
  $.checkArgument(privateKey, 'privateKey is required');
  $.checkArgument(!ivbuf || ivbuf.length === 16, 'ivbuf must be 16 bytes');

  if (!Buffer.isBuffer(message)) {
    message = Buffer.from(message);
  }
  if (!ivbuf) {
    if (opts.deterministicIv) {
      ivbuf = Hash.sha256hmac(message, privateKey.toBuffer()).subarray(0, 16);
    } else {
      ivbuf = crypto.randomBytes(16);
    }
  }
  if (!(publicKey instanceof PublicKey)) {
    publicKey = new PublicKey(publicKey);
  }
  if (!(privateKey instanceof PrivateKey)) {
    privateKey = new PrivateKey(privateKey);
  }

  const [kE, kM] = KDF(privateKey, publicKey);

  const cipher = crypto.createCipheriv('aes-256-cbc', kE, ivbuf);
  const cipherText = Buffer.concat([cipher.update(message), cipher.final()]);
  
  let tag = Hash.sha256hmac(cipherText, kM);
  if (opts.shortTag) {
    tag = tag.subarray(0, 4);
  }

  let encbuf;
  if (opts.noKey) {
    encbuf = Buffer.concat([ivbuf, cipherText, tag]);
  } else {
    const Rbuf = privateKey.publicKey.toDER(true);
    encbuf = Buffer.concat([Rbuf, ivbuf, cipherText, tag]);
  }
  return encbuf;
};

/**
 * Decrypt the payload
 * @param {object} params
 * @param {Buffer} params.payload Encrypted payload buffer.
 * @param {PrivateKey} params.privateKey Your private key is used to decrypt the payload.
 * @param {PublicKey} params.publicKey Sender's public key is used to verify the payload.
 *                              *Only* include this if the encrypter specified the `noKey` option, otherwise the public key is included in the payload.
 * @param {object} [params.opts] Options object. Every field is optional.
 * @param {boolean} [params.opts.shortTag] - Use 4-byte tag instead of 32-byte.
 *                              This was decided during encryption and must be communicated by the sender.
 * @returns {Buffer} Decrypted message buffer.
 */
function decrypt({ payload, privateKey, publicKey, opts = {} }) {
  $.checkArgument(Buffer.isBuffer(payload), 'payload must be a Buffer');
  $.checkArgument(privateKey, 'privateKey is required');
  
  if (!(privateKey instanceof PrivateKey)) {
    privateKey = new PrivateKey(privateKey);
  }

  if (publicKey && !(publicKey instanceof PublicKey)) {
    publicKey = new PublicKey(publicKey);
  }

  let offset = 0;
  const tagLength = opts.shortTag ? 4 : 32;
  if (!publicKey) {
    let pub;
    switch(payload[0]) {
      case 4:
        pub = payload.subarray(0, 65);
        break;
      case 3:
      case 2:
        pub = payload.subarray(0, 33);
        break;
      default:
        throw new Error('Invalid type: ' + payload[0]);
    }
    publicKey = PublicKey.fromDER(pub);
    offset += pub.length;
  }

  const ivbuf = payload.subarray(offset, offset + 16);
  const cipherText = payload.subarray(offset + 16, payload.length - tagLength);
  const tag = payload.subarray(payload.length - tagLength, payload.length);

  const [kE, kM] = KDF(privateKey, publicKey);

  const tag2 = Hash.sha256hmac(cipherText, kM).subarray(0, tagLength);
  if (tag2.compare(tag) !== 0) {
    throw new Error('Invalid checksum');
  }

  const cipher = crypto.createDecipheriv('aes-256-cbc', kE, ivbuf);
  const message = Buffer.concat([cipher.update(cipherText), cipher.final()]);
  return message;
};

module.exports.KDF = KDF;
module.exports.encrypt = encrypt;
module.exports.decrypt = decrypt;