import * as os from 'os';
import * as fs from 'fs';
import { Encryption } from './encryption';
import levelup, { LevelUp } from 'levelup';
import { LevelDown } from 'leveldown';
import leveldownjs from 'level-js';

let lvldwn: LevelDown;
let usingBrowser = (global as any).window;
if (usingBrowser) {
  lvldwn = leveldownjs;
} else {
  lvldwn = require('leveldown');
}
const bitcoreLib = require('bitcore-lib');
const StorageCache: { [path: string]: LevelUp } = {};

export class Storage {
  path: string;
  db: LevelUp;
  constructor(params: {
    path?: string;
    createIfMissing: boolean;
    errorIfExists: boolean;
  }) {
    const { path, createIfMissing, errorIfExists } = params;
    let basePath;
    if (!path) {
      basePath = `${os.homedir()}/.bitcore`;
      try {
        if (!usingBrowser) {
          fs.mkdirSync(basePath);
        }
      } catch (e) {
        if (e.errno !== -17) {
          console.error('Unable to create bitcore storage directory');
        }
      }
    }
    this.path = path || `${basePath}/bitcoreWallet`;
    if (!createIfMissing && !usingBrowser) {
      const walletExists =
        fs.existsSync(this.path) &&
        fs.existsSync(this.path + '/LOCK') &&
        fs.existsSync(this.path + '/LOG');
      if (!walletExists) {
        throw new Error('Not a valid wallet path');
      }
    }
    if (StorageCache[this.path]) {
      this.db = StorageCache[this.path];
    } else {
      console.log('creating leveldown at', this.path);
      this.db = StorageCache[this.path] = levelup(lvldwn(this.path), {
        createIfMissing,
        errorIfExists
      });
    }
  }

  async loadWallet(params: { name: string }) {
    const { name } = params;
    const wallet = (await this.db.get(`wallet|${name}`)) as string;
    if (!wallet) {
      return;
    }
    return JSON.parse(wallet);
  }

  listWallets() {
    if (usingBrowser) {
      return this.db.createValueStream();
    } else {
      return this.db.createValueStream({
        gt: Buffer.from('walle'),
        lt: Buffer.from('wallf')
      });
    }
  }

  async saveWallet(params) {
    const { wallet } = params;
    return this.db.put(`wallet|${wallet.name}`, JSON.stringify(wallet));
  }

  async getKey(params) {
    const { address, name, encryptionKey } = params;
    const payload = (await this.db.get(`key|${name}|${address}`)) as string;
    const json = JSON.parse(payload) || payload;
    const { encKey, pubKey } = json;
    if (encryptionKey && pubKey) {
      const decrypted = Encryption.decryptPrivateKey(
        encKey,
        Buffer.from(pubKey, 'hex'),
        Buffer.from(encryptionKey, 'hex')
      );
      return JSON.parse(decrypted);
    } else {
      return json;
    }
  }

  async addKeys(params) {
    const { name, keys, encryptionKey } = params;
    const ops = keys.map(key => {
      let { pubKey } = key;
      pubKey =
        pubKey || new bitcoreLib.PrivateKey(key.privKey).publicKey.toString();
      let payload = {};
      if (pubKey && key.privKey && encryptionKey) {
        const encKey = Encryption.encryptPrivateKey(
          JSON.stringify(key),
          Buffer.from(pubKey, 'hex'),
          Buffer.from(encryptionKey, 'hex')
        );
        payload = { encKey, pubKey };
      }
      return {
        type: 'put',
        key: `key|${name}|${key.address}`,
        value: JSON.stringify(payload)
      };
    });

    return this.db.batch(ops);
  }
}
