import * as fs from 'fs';
import * as os from 'os';
import * as stream from 'stream';
import { IWallet } from 'src/types/wallet';
import { StreamUtil } from '../stream-util';
import { Wallet } from '../wallet';

export class TextFile {
  db: string;
  walletFileName: string;
  addressFileName: string;

  constructor(params: { path?: string; createIfMissing: boolean; errorIfExists: boolean }) {
    const { path, createIfMissing } = params;
    let basePath;
    if (!path) {
      basePath = `${os.homedir()}/.bitcore/bitcoreWallet/textWallets`;
      try {
        fs.mkdirSync(basePath);
      } catch (e) {
        if (e.errno !== -17) {
          console.error('Unable to create bitcore storage directory');
        }
      }
    }
    this.db = path || basePath;
    this.walletFileName = this.db + '/wallets.txt';
    this.addressFileName = this.db + '/addresses.txt';
    if (!createIfMissing) {
      const walletPath = fs.existsSync(this.db);
      if (!walletPath) {
        throw new Error('Not a valid wallet path');
      }
    }
    console.log('using wallets at', this.db);
  }

  async loadWallet(params: { name: string }) {
    const { name } = params;
    return new Promise<void | string>((resolve, reject) => {
      const readStream = fs.createReadStream(this.walletFileName, { flags: 'a+', encoding: 'utf8' });
      readStream.on('error', err => {
        reject(err);
      });
      readStream
        .pipe(StreamUtil.jsonlBufferToObjectMode())
        .on('data', (wallet: IWallet) => {
          if (wallet.name === name) {
            resolve(JSON.stringify(wallet));
          }
        })
        .on('end', () => {
          resolve();
        });
    });
  }

  async deleteWallet(params: { name: string; keepAddresses?: boolean }) {
    const { name, keepAddresses } = params;
    const wallets: Array<object> = await new Promise((resolve, reject) => {
      const walletArray = [];
      fs.createReadStream(this.walletFileName, { flags: 'r', encoding: 'utf8' })
        .pipe(StreamUtil.jsonlBufferToObjectMode())
        .on('data', wallet => {
          if (wallet.name !== name) {
            walletArray.push(wallet);
          }
        })
        .on('end', () => {
          resolve(walletArray);
        })
        .on('error', err => reject(err));
    });
    await new Promise<void>(resolve => {
      const walletStream = new stream.Readable({ objectMode: true });
      for (const wallet of wallets) {
        walletStream.push(wallet);
      }
      walletStream.push(null);
      const writeStream = fs.createWriteStream(this.walletFileName, { flags: 'w', encoding: 'utf8' });
      walletStream.pipe(StreamUtil.objectModeToJsonlBuffer()).pipe(writeStream);
      writeStream.once('close', () => {
        resolve();
      });
    });
    if (!keepAddresses) {
      const addresses: Array<object> = await new Promise((resolve, reject) => {
        const addressArray = [];
        fs.createReadStream(this.addressFileName, { flags: 'r', encoding: 'utf8' })
          .pipe(StreamUtil.jsonlBufferToObjectMode())
          .on('data', address => {
            if (address.name !== name) {
              addressArray.push(address);
            }
          })
          .on('end', () => {
            resolve(addressArray);
          })
          .on('error', err => reject(err));
      });
      await new Promise<void>(resolve => {
        const addressStream = new stream.Readable({ objectMode: true });
        for (const address of addresses) {
          addressStream.push(address);
        }
        addressStream.push(null);
        const writeStream = fs.createWriteStream(this.addressFileName, { flags: 'w', encoding: 'utf8' });
        addressStream.pipe(StreamUtil.objectModeToJsonlBuffer()).pipe(writeStream);
        writeStream.once('close', () => {
          resolve();
        });
      });
    }
  }

  async listWallets() {
    return fs
      .createReadStream(this.walletFileName, { flags: 'r', encoding: 'utf8' })
      .pipe(StreamUtil.jsonlBufferToObjectMode())
      .pipe(
        new stream.Transform({
          objectMode: true,
          write(data, enc, next) {
            this.push(JSON.stringify(data));
            next();
          }
        })
      );
  }

  async listKeys() {
    return fs.createReadStream(this.addressFileName, { flags: 'r', encoding: 'utf8' }).pipe(
      new stream.Transform({
        objectMode: true,
        write(data, enc, next) {
          this.push({
            data: data.value.toString(),
            key: data.key.toString(),
            storageType: 'TextFile'
          });
          next();
        }
      })
    );
  }

  async saveWallet(params: { wallet: Wallet }) {
    const { wallet } = params;
    delete wallet.storage;
    const wallets: Array<IWallet> = await new Promise((resolve, reject) => {
      const walletArray: IWallet[] = [];
      fs.createReadStream(this.walletFileName, { flags: 'r', encoding: 'utf8' })
        .pipe(StreamUtil.jsonlBufferToObjectMode())
        .on('data', (wallet: IWallet) => {
          walletArray.push(wallet);
        })
        .on('end', () => {
          resolve(walletArray);
        })
        .on('error', err => reject(err));
    });
    const walletAlreadyExists = wallets.find(savedWallet => savedWallet.name === wallet.name);
    if (walletAlreadyExists) {
      await this.deleteWallet({ name: wallet.name, keepAddresses: true });
    }
    return new Promise<void>(resolve => {
      const walletStream = new stream.Readable({ objectMode: true });
      const writeStream = fs.createWriteStream(this.walletFileName, { flags: 'a' });
      walletStream.push(wallet);
      walletStream.push(null);
      walletStream.pipe(StreamUtil.objectModeToJsonlBuffer()).pipe(writeStream);
      writeStream.once('close', () => {
        resolve();
      });
    });
  }

  async getKey(params: { address: string; name: string; keepAlive: boolean; open: boolean }) {
    const { address, name } = params;
    return new Promise(resolve => {
      fs.createReadStream(this.addressFileName, { flags: 'r', encoding: 'utf8' })
        .pipe(StreamUtil.jsonlBufferToObjectMode())
        .on('data', data => {
          if (data.name === name && data.address === address) {
            resolve(data.toStore);
          }
        })
        .on('end', () => {
          resolve(null);
        });
    });
  }

  async addKeys(params: { name: string; key: any; toStore: string; keepAlive: boolean; open: boolean }) {
    const { name, key, toStore } = params;
    const objectToSave = { name, address: key.address, toStore };
    return new Promise<void>(resolve => {
      const readStream = new stream.Readable({ objectMode: true });
      const writeStream = fs.createWriteStream(this.addressFileName, { flags: 'a' });
      readStream.push(objectToSave);
      readStream.push(null);
      readStream.pipe(StreamUtil.objectModeToJsonlBuffer()).pipe(writeStream);
      writeStream.once('close', () => {
        resolve();
      });
    });
  }

  async getAddress(params: { name: string; address: string; keepAlive: boolean; open: boolean }) {
    const { name, address, keepAlive, open } = params;
    const key: any = await this.getKey({ name, address, keepAlive, open });
    if (!key) {
      return null;
    }
    const { pubKey, path } = JSON.parse(key);
    return { address, pubKey, path };
  }

  async getAddresses(params: { name: string; limit?: number; skip?: number }) {
    const { name, limit, skip } = params;
    const addresses = [];
    let skipped = 0;
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(this.addressFileName, { flags: 'r', encoding: 'utf8' });
      stream.pipe(StreamUtil.jsonlBufferToObjectMode())
        .on('data', data => {
          if (data.name === name) {
            if (skipped <= skip) {
              skipped++;
              return;
            }
            if (limit && addresses.length >= limit) {
              stream.destroy();
              resolve(addresses);
            }

            const address = data.address;
            const valJSON = JSON.parse(data.toStore.toString());
            addresses.push({ address, pubKey: valJSON.pubKey, path: valJSON.path });
          }
        })
        .on(('error'), err => {
          reject(err);
        })
        .on('end', () => {
          resolve(addresses);
        });
    });
  }
}
