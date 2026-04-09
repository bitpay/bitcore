import * as fs from 'fs';
import * as os from 'os';
import * as stream from 'stream';
import { pipeline } from 'stream/promises';
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
    /**
     * `addresses.txt` is stored as JSONL: one address record per line.
     *
     * That line-oriented contract matters beyond normal reads/writes. The migration
     * rewrite path reparses the file as individual JSON records, transforms selected
     * records, and writes the file back out. If this writer ever stops emitting exactly
     * one serialized address object per line, `migrate()` would need to change too.
     */
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

  /**
   * Rewrite the address file in place for a specific migration version.
   *
   * Why a transformer?
   * The TextFile backend is append-only. That is simple for normal writes, but it means
   * migration cannot "overwrite" an existing address entry by appending a new one because
   * `getKey()` still resolves the first matching line it encounters. For migration we
   * therefore treat `addresses.txt` like a stream of JSONL records:
   *
   * 1. Read bytes from the existing file.
   * 2. Parse each JSONL line into an object.
   * 3. Pass each object through a Transform stream that replaces only the records that
   *    belong to this wallet/address set.
   * 4. Serialize the transformed objects back to JSONL.
   * 5. Write the result to a temporary file and atomically rename it into place.
   *
   * This lets us preserve the file order and all unrelated records while updating the
   * migrated addresses in a single pass.
   */
  async migrate(params: { version: number; name: string; keys: any[] }) {
    const { version, name, keys } = params;
    if (version !== 1) {
      throw new Error(`TextFile migration for wallet version ${version} is not supported`);
    }

    const replacementRecords = new Map(
      keys.map(key => {
        const { path, pubKey } = key;
        if (!pubKey) {
          throw new Error(`pubKey is undefined for ${name}. TextFile migration aborted`);
        }
        const toStore = JSON.stringify({ key: JSON.stringify(key), pubKey, path });
        return [key.address, { name, address: key.address, toStore }];
      })
    );

    const tempAddressFileName = `${this.addressFileName}.v${version}.migrating`;

    /**
     * The transform stream is the "rewrite policy" for migration.
     *
     * Each record coming in is one parsed JSON object from the source file.
     * We either:
     * - push it through unchanged, or
     * - replace it with the migrated version for the same wallet/address.
     *
     * The important thing to notice is that Transform streams do not need to change the
     * number of records. They can simply emit a modified version of the incoming record,
     * which makes them a nice fit for "rewrite this file in one pass" jobs like this.
     */
    const migrationTransform = new stream.Transform({
      writableObjectMode: true,
      readableObjectMode: true,
      transform(record, _encoding, callback) {
        try {
          // Not target wallet - pass through unchanged
          if (record.name !== name) {
            this.push(record);
            callback();
            return;
          }

          const replacement = replacementRecords.get(record.address);
          /**
           * If replacement not in map, indicates a prior-existing address which was not included in the keys to migrate.
           * Fall back to prior.
           */
          if (!replacement) {
            console.warn(`TextFile migration warning: found address ${record.address} for wallet ${name}, but no replacement key was provided. Keeping original record.`);
          }
          this.push(replacement ?? record);
          callback();
        } catch (err) {
          callback(err as Error);
        }
      }
    });

    try {
      await pipeline(
        fs.createReadStream(this.addressFileName, { flags: 'r', encoding: 'utf8' }),
        StreamUtil.jsonlBufferToObjectMode(),
        migrationTransform,
        StreamUtil.objectModeToJsonlBuffer(),
        fs.createWriteStream(tempAddressFileName, { flags: 'w', encoding: 'utf8' })
      );
      await fs.promises.rename(tempAddressFileName, this.addressFileName);
    } catch (err) {
      await fs.promises.rm(tempAddressFileName, { force: true }).catch(() => undefined);
      throw err;
    }
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
