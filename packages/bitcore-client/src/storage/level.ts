import * as fs from 'fs';
import * as os from 'os';
import levelup, { LevelUp } from 'levelup';
import leveldn from 'leveldown';
import { Transform } from 'stream';

const usingBrowser = 'window' in globalThis;
const StorageCache: { [path: string]: LevelUp } = {};

export class Level {
  path: string;
  db: LevelUp;

  constructor(params: { path?: string; createIfMissing: boolean; errorIfExists: boolean }) {
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
        fs.existsSync(this.path) && fs.existsSync(this.path + '/LOCK') && fs.existsSync(this.path + '/LOG');
      if (!walletExists) {
        throw new Error('Not a valid wallet path');
      }
    }
    if (StorageCache[this.path]) {
      this.db = StorageCache[this.path];
    } else {
      console.log('using wallets at', this.path);
      this.db = StorageCache[this.path] = levelup(leveldn(this.path), {
        createIfMissing,
        errorIfExists
      });
    }
  }

  async loadWallet(params: { name: string }) {
    const { name } = params;
    return (await this.db.get(`wallet|${name}`)) as string;
  }

  async deleteWallet(params: { name: string }) {
    const { name } = params;
    // await this.db.del(`wallet|${name}`);
    const keysToDelete = await new Promise<string[]>((resolve, reject) => {
      const walletKeys = [];
      this.db.createKeyStream()
        .on('data', (key: Buffer) => {
          if (key.toString().startsWith(`wallet|${name}`)) {
            walletKeys.push(key);
          } else if (key.toString().startsWith(`key|${name}|`)) {
            walletKeys.push(key);
          }
        })
        .on('error', (err: Error) => {
          reject(err);
        })
        .on('end', () => {
          resolve(walletKeys);
        });
    });
    let batch = this.db.batch();
    for (const key of keysToDelete) {
      batch = batch.del(key);
    }
    await batch.write();
  }

  async listWallets() {
    return this.db.createReadStream().pipe(
      new Transform({
        objectMode: true,
        write(data, enc, next) {
          if (data.key.toString().startsWith('wallet')) {
            const jsonData = JSON.parse(data.value.toString());
            jsonData.storageType = 'Level';
            this.push(JSON.stringify(jsonData));
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
        write(data, enc, next) {
          if (data.key.toString().startsWith('key')) {
            this.push({
              data: data.value.toString(),
              key: data.key.toString(),
              storageType: 'Level'
            });
          }
          next();
        }
      })
    );
  }

  async saveWallet(params) {
    const { wallet } = params;
    delete wallet.storage;
    return this.db.put(`wallet|${wallet.name}`, JSON.stringify(wallet));
  }

  async getKey(params: { address: string; name: string; keepAlive: boolean; open: boolean }) {
    const { address, name } = params;
    return (await this.db.get(`key|${name}|${address}`)) as string;
  }

  async addKeys(params: { name: string; key: any; toStore: string; keepAlive: boolean; open: boolean }) {
    const { name, key, toStore } = params;
    await this.db.put(`key|${name}|${key.address}`, toStore);
  }

  async getAddress(params: { name: string; address: string; keepAlive: boolean; open: boolean }) {
    const { name, address, keepAlive, open } = params;
    const data: string = (await this.getKey({ address, name, keepAlive, open })).toString();
    if (!data) {
      return null;
    }
    const { pubKey, path } = JSON.parse(data);
    return { address, pubKey, path };
  }
  
  async getAddresses(params: { name: string; limit?: number; skip?: number }) {
    const { name, limit, skip } = params;
    const addresses = [];
    let skipped = 0;
    const stream = this.db.createReadStream();
    return new Promise((resolve, reject) => {
      stream
        .on('data', function({ key, value }) {
          if (key.toString().startsWith(`key|${name}|`)) {
            if (skipped <= skip) {
              skipped++;
              return;
            }
            if (limit && addresses.length >= limit) {
              stream.destroy();
              resolve(addresses);
            }
            
            const address = key.toString().split('|')[2];
            const valJSON = JSON.parse(value.toString());
            addresses.push({ address, pubKey: valJSON.pubKey, path: valJSON.path });
          }
        })
        .on('error', function(err) {
          reject(err);
        })
        .on('end', function() {
          resolve(addresses);
        });
    });
  }
}
