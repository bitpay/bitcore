const levelup = require('levelup');
const leveldown = require('leveldown');
const Encrypter = require('./encryption');

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
    if (encryptionKey) {
      const { encKey, pubKey } = payload;
      const decrypted = Encrypter.decryptPrivateKey(
        encKey,
        pubKey,
        encryptionKey
      );
      return decrypted;
    } else {
      return payload;
    }
  }
  async addKey(params) {
    const { key, encryptionKey } = params;
    const { pubKey } = key;
    let payload = {};
    if (pubKey && key.privKey && encryptionKey) {
      const encKey = Encrypter.encryptPrivateKey(
        JSON.stringify(key),
        pubKey,
        encryptionKey
      );
      payload = { encKey, pubKey };
    }
    return this.db.put(`address|${key.address}`, payload);
  }
}

module.exports = Storage;
