const os = require('os');
const fs = require('fs');
const levelup = require('levelup');
const leveldown = require('leveldown');
const Encrypter = require('./encryption');
const bitcoreLib = require('bitcore-lib');

class Storage {
  constructor(params) {
    const { path, createIfMissing, errorIfExists } = params;
    let basePath;
    if (!path) {
      basePath = `${os.homedir()}/.bitcore`;
      try {
        fs.mkdirSync(basePath);
      } catch (e) {
        if (e.errno !== -17) {
          console.error('Unable to create bitcore storage directory');
        }
      }
    }
    this.path = path || `${basePath}/bitcoreWallet`;
    if(!createIfMissing) {
      const walletExists = fs.existsSync(this.path) && fs.existsSync(this.path + '/LOCK') && fs.existsSync(this.path + '/LOG');
      if(!walletExists) {
        throw new Error('Not a valid wallet path');
      }
    }
    this.db = levelup(leveldown(this.path), { createIfMissing, errorIfExists });
  }
  async loadWallet(params) {
    const { name } = params;
    return new Promise(async (resolve, reject) => {
      try {
        const wallet = await this.db.get(`wallet|${name}`);
        if (wallet) {
          resolve(JSON.parse(wallet));
        }
        resolve(null);
      } catch (err) {
        reject(err);
      }
    });
  }

  listWallets() {
    return this.db.createValueStream({ gt: Buffer.from('walle'), lt: Buffer.from('wallf') });
  }

  async saveWallet(params) {
    const { wallet } = params;
    return this.db.put(`wallet|${wallet.name}`, JSON.stringify(wallet));
  }
  async getKey(params) {
    const { address, name, encryptionKey } = params;
    const payload = await this.db.get(`key|${name}|${address}`);
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
    const { name, key, encryptionKey } = params;
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
    return this.db.put(`key|${name}|${key.address}`, JSON.stringify(payload));
  }
}

module.exports = Storage;
