const levelup = require('levelup');
const leveldown = require('leveldown');
const Encrypter = require('./encryption');
const bitcoreLib = require('bitcore-lib');

class Storage {
  constructor(params) {
    const { path, createIfMissing, errorIfExists } = params;
    this.db = levelup(leveldown(path), { createIfMissing, errorIfExists });
  }
  async loadWallet() {
    return new Promise(async (resolve, reject) => {
      try {
        const wallet = await this.db.get('wallet');
        if (wallet) {
          resolve(JSON.parse(wallet));
        }
        resolve(null);
      } catch (err) {
        reject(err);
      }
    });
  }
  async saveWallet(params) {
    const { wallet } = params;
    return this.db.put('wallet', JSON.stringify(wallet));
  }
  async getKey(params) {
    const { address, encryptionKey } = params;
    const payload = await this.db.get(`address|${address}`);
    const json = JSON.parse(payload) || payload;
    const { encKey, pubKey } = json;
    if (encryptionKey && pubKey) {
      const decrypted = Encrypter.decryptPrivateKey(
        encKey,
        Buffer.from(pubKey, 'hex'),
        Buffer.from(encryptionKey, 'hex')
      );
      return JSON.parse(decrypted);
    } else {
      json;
    }
  }
  async addKey(params) {
    const { key, encryptionKey } = params;
    let { pubKey } = key;
    pubKey = pubKey || new bitcoreLib.PrivateKey(key.privKey).publicKey.toString();
    let payload = {};
    if (pubKey && key.privKey && encryptionKey) {
      const encKey = Encrypter.encryptPrivateKey(
        JSON.stringify(key),
        Buffer.from(pubKey, 'hex'),
        Buffer.from(encryptionKey, 'hex')
      );
      payload = { encKey, pubKey };
    }
    return this.db.put(`address|${key.address}`, JSON.stringify(payload));
  }
}

module.exports = Storage;
