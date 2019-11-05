import * as os from 'os';
import * as fs from 'fs';
import levelup, { LevelUp } from 'levelup';
import { LevelDown } from 'leveldown';
import { Transform } from 'stream';

let lvldwn: LevelDown;
let usingBrowser = (global as any).window;
if (usingBrowser) {
  lvldwn = require('level-js');
} else {
  lvldwn = require('leveldown');
}
const StorageCache: { [path: string]: LevelUp } = {};

export class Level {
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
      console.log('using wallets at', this.path);
      this.db = StorageCache[this.path] = levelup(lvldwn(this.path), {
        createIfMissing,
        errorIfExists
      });
    }
  }

  async loadWallet(params: { name: string }) {
    const { name } = params;
    return (await this.db.get(`wallet|${name}`)) as string;
  }

  async listWallets() {
    return this.db.createReadStream().pipe(
      new Transform({
        objectMode: true,
        write: function(data, enc, next) {
          if (data.key.toString().startsWith('wallet')) {
            this.push(data.value.toString());
          }
          next();
        }
      })
    );
  }

  async listKeys() {
    return this.db.createReadStream().pipe(
      new Transform({
        objectMode: true,
        write: function(data, enc, next) {
          if (data.key.toString().startsWith('key')) {
            this.push({
              data: data.value.toString(),
              key: data.key.toString()
            });
          }
          next();
        }
      })
    );
  }

  async saveWallet(params) {
    const { wallet } = params;
    return this.db.put(`wallet|${wallet.name}`, JSON.stringify(wallet));
  }

  async getKey(params: {
    address: string;
    name: string;
    keepAlive: boolean;
    open: boolean;
  }) {
    const { address, name } = params;
    return (await this.db.get(`key|${name}|${address}`)) as string;
  }

  async addKeys(params: {
    name: string;
    key: any
    toStore: string;
    keepAlive: boolean;
    open: boolean;
  }) {
    const { name, key, toStore} = params;
    await this.db.put(`key|${name}|${key.address}`, toStore);
  }
}
