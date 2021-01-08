import * as fs from 'fs';
import * as os from 'os';
import * as stream from 'stream';
import { StreamUtil } from 'stream-util';

export class TextFile {
  db: string;
  constructor(params: { path?: string; createIfMissing: boolean; errorIfExists: boolean }) {
    const { path, createIfMissing } = params;
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
    this.db = path || `${basePath}/bitcoreWallet/wallets.txt`;
    if (!createIfMissing) {
      const walletExists =
        fs.existsSync(this.db) && fs.existsSync(this.db + '/LOCK') && fs.existsSync(this.db + '/LOG');
      if (!walletExists) {
        throw new Error('Not a valid wallet path');
      }
    }
    console.log('using wallets at', this.db);
  }

  async loadWallet(params: { name: string }) {
    const { name } = params;
    fs.createReadStream(this.db, {flags: 'r', encoding: 'utf8'})
      .pipe(StreamUtil.jsonlBufferToObjectMode())
      .on('data', (wallet) => {
        if (wallet.name && wallet.name === name) {
          return wallet;
        }
      });
  }

  async deleteWallet(params: { name: string }) {
    const { name } = params;
    // await this.db.del(`wallet|${name}`);
  }

  async listWallets() {
    fs.createReadStream(this.db, {flags: 'r', encoding: 'utf8'})
    // return this.db.createReadStream().pipe(
    //   new Transform({
    //     objectMode: true,
    //     write(data, enc, next) {
    //       if (data.key.toString().startsWith('wallet')) {
    //         const jsonData = JSON.parse(data.value.toString());
    //         jsonData.storageType = 'Level';
    //         this.push(JSON.stringify(jsonData));
    //       }
    //       next();
    //     }
    //   })
    // );
  }

  async listKeys() {
    // return this.db.createReadStream().pipe(
    //   new Transform({
    //     objectMode: true,
    //     write(data, enc, next) {
    //       if (data.key.toString().startsWith('key')) {
    //         this.push({
    //           data: data.value.toString(),
    //           key: data.key.toString(),
    //           storageType: 'Level'
    //         });
    //       }
    //       next();
    //     }
    //   })
    // );
  }

  async saveWallet(params) {
    const { wallet } = params;
    delete wallet.storage;
    const readStream = new stream.Readable({ objectMode: true });
    const writeStream = fs.createWriteStream(this.db);
    readStream.push(wallet);
    readStream.push(null);
    readStream.pipe(StreamUtil.objectModeToJsonlBuffer()).pipe(writeStream);
  }

  async getKey(params: { address: string; name: string; keepAlive: boolean; open: boolean }) {
    const { address, name } = params;
    // return (await this.db.get(`key|${name}|${address}`)) as string;
  }

  async addKeys(params: { name: string; key: any; toStore: string; keepAlive: boolean; open: boolean }) {
    const { name, key, toStore } = params;
    // await this.db.put(`key|${name}|${key.address}`, toStore);
  }
}
