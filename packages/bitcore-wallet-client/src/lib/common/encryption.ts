'use strict';

import crypto from 'crypto';
import sjcl from 'sjcl';

const PBKDF2_ITERATIONS = 1000;
const DEFAULT_KEY_SIZE = 256; // bits
const ALGORITHM = ks => `aes-${ks || DEFAULT_KEY_SIZE}-gcm`;
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 16; // 128 bits
const IV_LENGTH = 12; // 12 bytes standard for GCM mode (96 bits)


export interface IBaseEncrypted {
  iv: string;
  v: number;
  ts: number;
  mode: 'ccm' | 'gcm';
  adata: string;
  cipher: 'aes';
  ct: string;
}

export interface IEncrypted extends IBaseEncrypted {
  ks: number;
  iter?: number;
  salt?: string;
}

class EncryptionClass {
  /**
   * @private
   * For CCM mode, the IV length must be between 7 and 13 bytes.
   * However, IV size can depend on the length of the data.
   * The max data length for a 13 byte IV is 64KiB, 12 byte IV is ~16MiB,
   *  and 11 byte IV is up to ~4GB. A smaller IV can be used for larger
   *  data but has a greater risk of collisions, so a larger IV is ideal
   *  for smaller data sizes.
   * @param {number} length Length of bytes to encrypt/decrypt
   * @param {Buffer} iv Initialization vector (IV - aka nonce) buffer
   * @returns {Buffer}
   */
  _optimizeIv(length: number, iv: Buffer) {
    let L = 2;
    while (L < 4 && length >= Math.pow(2, 8 * L)) { L++; }
    if (L < 15 - iv.length) { L = 15 - iv.length; }
    iv = iv.subarray(0, 15 - L);
    return iv;
  }

  _baseEncrypt(data, key: Buffer): IBaseEncrypted {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data), 'utf8');
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      ALGORITHM(key.length * 8), 
      key, 
      iv, 
      { authTagLength: AUTH_TAG_LENGTH } as crypto.CipherGCMOptions
    ) as crypto.CipherGCM;
    let encrypted = cipher.update(buf);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return {
      iv: iv.toString('base64'),
      v: 1,
      ts: AUTH_TAG_LENGTH * 8,
      mode: 'gcm',
      adata: '',
      cipher: 'aes',
      ct: Buffer.concat([encrypted, cipher.getAuthTag()]).toString('base64')
    };
  }

  encryptWithKey(data, key: string | Buffer): IEncrypted {
    key = Buffer.isBuffer(key) ? key : Buffer.from(key, 'base64');
    const result = this._baseEncrypt(data, key);
    return {
      ...result,
      ks: key.length * 8, // key size in bits
    };
  }

  encryptWithPassword(data, password: string, opts?: { iter?: number; ks?: number }): IEncrypted {
    opts = opts || {};
    opts.iter = opts.iter || PBKDF2_ITERATIONS;
    opts.ks = opts.ks || DEFAULT_KEY_SIZE;
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = crypto.pbkdf2Sync(password, salt, opts.iter, opts.ks / 8, 'sha256');
    const result = this._baseEncrypt(data, key);
    return {
      ...result,
      iter: opts.iter,
      ks: opts.ks,
      salt: salt.toString('base64'),
    };
  }

  _baseDecrypt(data: string | IEncrypted, key: Buffer) {
    const json: IEncrypted = typeof data === 'string' ? JSON.parse(data) : data;
    const ct = Buffer.from(json.ct, 'base64');
    const authTagLength = json.ts / 8;
    const ciphertext = ct.subarray(0, ct.length - authTagLength);
    const authTag = ct.subarray(ct.length - authTagLength);
    let iv;
    let decipher;
    if (json.mode === 'gcm') {
      iv = Buffer.from(json.iv, 'base64');
      decipher = crypto.createDecipheriv(
        `${json.cipher}-${json.ks}-${json.mode}`, 
        key, 
        iv, 
        { authTagLength } as crypto.CipherGCMOptions
      ) as crypto.DecipherGCM;
    } else {
      iv = this._optimizeIv(ciphertext.length, Buffer.from(json.iv, 'base64'));
      decipher = crypto.createDecipheriv(`${json.cipher}-${json.ks}-${json.mode}`, 
        key, 
        iv, 
        { authTagLength, plaintextLength: ciphertext.length } as crypto.CipherCCMOptions
      ) as crypto.DecipherCCM;
    }
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
  }

  decryptWithKey(data: string | IEncrypted, key: string | Buffer) {
    try {
      const keyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(key, 'base64');
      return this._baseDecrypt(data, keyBuffer);
    } catch (err) {
      try {
        return sjcl.decrypt(key, data);
      } catch {
        throw err;
      }
    }
  }

  decryptWithPassword(data: string | IEncrypted, password: string) {
    try {
      const json = typeof data === 'string' ? JSON.parse(data) : data;
      const key = crypto.pbkdf2Sync(password, Buffer.from(json.salt, 'base64'), json.iter, json.ks / 8, 'sha256');
      return this._baseDecrypt(json, key);
    } catch (err) {
      try {
        return sjcl.decrypt(password, data);
      } catch {
        throw err;
      }
    }
  }
}

export const Encryption = new EncryptionClass();