import * as Bcrypt from 'bcryptjs';
import { Encryption } from './encryption';
import { Client } from './client';
import { Storage } from './storage';
import { Transactions, Deriver } from 'crypto-wallet-core';
const { PrivateKey } = require('crypto-wallet-core').BitcoreLib;
const Mnemonic = require('bitcore-mnemonic');
const { ParseApiStream } = require('./stream-util');

export namespace Wallet {
  export type KeyImport = {
    address: string;
    privKey?: string;
    pubKey?: string;
  };
  export type WalletObj = {
    name: string;
    baseUrl: string;
    chain: string;
    network: string;
    path: string;
    phrase: string;
    password: string;
    storage: Storage;
  };
}
export class Wallet {
  masterKey: any;
  baseUrl: string;
  chain: string;
  network: string;
  client: Client;
  storage: Storage;
  unlocked?: { encryptionKey: string; masterKey: string };
  password: string;
  encryptionKey: string;
  authPubKey: string;
  pubKey: string;
  xPubKey: string;
  name: string;
  path: string;
  addressIndex?: number;
  authKey: string;
  derivationPath: string;

  constructor(params: Wallet | Wallet.WalletObj) {
    Object.assign(this, params);
    if (!this.baseUrl) {
      this.baseUrl = `https://api.bitcore.io/api`;
    }
    this.client = new Client({
      apiUrl: this.getApiUrl(),
      authKey: this.getAuthSigningKey()
    });
  }

  getApiUrl() {
    return `${this.baseUrl}/${this.chain}/${this.network}`;
  }

  saveWallet() {
    const walletInstance = Object.assign({}, this);
    delete walletInstance.unlocked;
    return this.storage.saveWallet({ wallet: walletInstance });
  }

  static async create(params: Partial<Wallet.WalletObj>) {
    const { chain, network, name, phrase, password, path } = params;
    let { storage } = params;
    if (!chain || !network || !name) {
      throw new Error('Missing required parameter');
    }
    // Generate wallet private keys
    const mnemonic = new Mnemonic(phrase);
    const hdPrivKey = mnemonic
      .toHDPrivateKey()
      .derive(Deriver.pathFor(chain, network));
    const privKeyObj = hdPrivKey.toObject();

    // Generate authentication keys
    const authKey = new PrivateKey();
    const authPubKey = authKey.toPublicKey().toString();

    // Generate public keys
    // bip44 compatible pubKey
    const pubKey = hdPrivKey.publicKey.toString();

    // Generate and encrypt the encryption key and private key
    const walletEncryptionKey = Encryption.generateEncryptionKey();
    const encryptionKey = Encryption.encryptEncryptionKey(
      walletEncryptionKey,
      password
    );
    const encPrivateKey = Encryption.encryptPrivateKey(
      JSON.stringify(privKeyObj),
      pubKey,
      walletEncryptionKey
    );

    storage =
      storage ||
      new Storage({
        path,
        errorIfExists: false,
        createIfMissing: true
      });

    let alreadyExists;
    try {
      alreadyExists = await this.loadWallet({ storage, name });
    } catch (err) {}
    if (alreadyExists) {
      throw new Error('Wallet already exists');
    }

    const wallet = Object.assign(params, {
      encryptionKey,
      authKey,
      authPubKey,
      masterKey: encPrivateKey,
      password: await Bcrypt.hash(password, 10),
      xPubKey: hdPrivKey.xpubkey,
      pubKey
    });
    // save wallet to storage and then bitcore-node
    await storage.saveWallet({ wallet });
    const loadedWallet = await this.loadWallet({
      storage,
      name
    });
    console.log(mnemonic.toString());
    await loadedWallet.register().catch(e => {
      console.debug(e);
      console.error('Failed to register wallet with bitcore-node.');
    });
    return loadedWallet;
  }

  static async exists(params: {
    name: string;
    path?: string;
    storage?: Storage;
  }) {
    const { storage, name } = params;
    let alreadyExists;
    try {
      alreadyExists = await Wallet.loadWallet({
        storage,
        name
      });
    } catch (err) {
      console.log(err);
    }
    return alreadyExists != undefined && alreadyExists != [];
  }

  static async loadWallet(params: {
    name: string;
    path?: string;
    storage?: Storage;
  }) {
    const { name, path } = params;
    let { storage } = params;
    storage =
      storage ||
      new Storage({ errorIfExists: false, createIfMissing: false, path });
    const loadedWallet = await storage.loadWallet({ name });
    return new Wallet(Object.assign(loadedWallet, { storage }));
  }

  lock() {
    this.unlocked = undefined;
    return this;
  }

  async unlock(password) {
    const encMasterKey = this.masterKey;
    let validPass = await Bcrypt.compare(password, this.password).catch(
      () => false
    );
    if (!validPass) {
      throw new Error('Incorrect Password');
    }
    const encryptionKey = await Encryption.decryptEncryptionKey(
      this.encryptionKey,
      password
    );
    const masterKeyStr = await Encryption.decryptPrivateKey(
      encMasterKey,
      this.pubKey,
      encryptionKey
    );
    const masterKey = JSON.parse(masterKeyStr);
    this.unlocked = {
      encryptionKey,
      masterKey
    };
    return this;
  }

  async register(params: { baseUrl?: string } = {}) {
    const { baseUrl } = params;
    if (baseUrl) {
      // save the new url without chain and network
      // then use the new url with chain and network below
      this.baseUrl = baseUrl;
      await this.saveWallet();
    }
    const payload = {
      name: this.name,
      pubKey: this.authPubKey,
      path: this.derivationPath,
      network: this.network,
      chain: this.chain,
      apiUrl: this.getApiUrl()
    };
    return this.client.register({ payload });
  }

  getAuthSigningKey() {
    return new PrivateKey(this.authKey);
  }

  getBalance(time?: string) {
    return this.client.getBalance({ pubKey: this.authPubKey, time });
  }

  getNetworkFee(params: { target?: number } = {}) {
    const target = params.target || 2;
    return this.client.getFee({ target });
  }

  getUtxos(params: { includeSpent?: boolean } = {}) {
    const { includeSpent = false } = params;
    return this.client.getCoins({
      pubKey: this.authPubKey,
      includeSpent
    });
  }

  listTransactions(params) {
    return this.client.listTransactions({
      ...params,
      pubKey: this.authPubKey
    });
  }

  async newTx(params: {
    utxos?: any[];
    recipients: { address: string; amount: number }[];
    from?: string;
    change?: string;
    invoiceID?: string;
    fee?: number;
    nonce?: number;
  }) {
    const payload = {
      network: this.network,
      chain: this.chain,
      recipients: params.recipients,
      from: params.from,
      change: params.change,
      invoiceID: params.invoiceID,
      fee: params.fee,
      wallet: this,
      utxos: params.utxos,
      nonce: params.nonce
    };
    return Transactions.create(payload);
  }

  async broadcast(params: { tx: string }) {
    const { tx } = params;
    const payload = {
      network: this.network,
      chain: this.chain,
      rawTx: tx
    };
    return this.client.broadcast({ payload });
  }
  async importKeys(params: { keys: Wallet.KeyImport[] }) {
    const { keys } = params;
    const { encryptionKey } = this.unlocked;
    const keysToSave = keys.filter(key => typeof key.privKey === 'string');
    if (keysToSave.length) {
      await this.storage.addKeys({
        keys: keysToSave,
        encryptionKey,
        name: this.name
      });
    }
    const addedAddresses = keys.map(key => {
      return { address: key.address };
    });
    return this.client.importAddresses({
      pubKey: this.authPubKey,
      payload: addedAddresses
    });
  }

  async signTx(params) {
    let { tx, keys, utxos, passphrase } = params;
    if (!utxos) {
      utxos = [];
      await new Promise((resolve, reject) => {
        this.getUtxos()
          .pipe(new ParseApiStream())
          .on('data', utxo => utxos.push(utxo))
          .on('end', () => resolve())
          .on('err', err => reject(err));
      });
    }
    let addresses = [];
    let decryptedKeys;
    if (!keys) {
      for (let utxo of utxos) {
        addresses.push(utxo.address);
      }
      addresses = addresses.length > 0 ? addresses : await this.getAddresses();
      decryptedKeys = await this.storage.getKeys({
        addresses,
        name: this.name,
        encryptionKey: this.unlocked.encryptionKey
      });
    } else {
      addresses.push(keys[0]);
      utxos.forEach(function(element) {
        let keyToDecrypt = keys.find(key => key.address === element.address);
        addresses.push(keyToDecrypt);
      });
      let decryptedParams = Encryption.bitcoinCoreDecrypt(
        addresses,
        passphrase
      );
      decryptedKeys = [...decryptedParams.jsonlDecrypted];
    }
    const payload = {
      chain: this.chain,
      network: this.network,
      tx,
      keys: decryptedKeys,
      key: decryptedKeys[0],
      utxos
    };
    return Transactions.sign({ ...payload });
  }

  async checkWallet() {
    return this.client.checkWallet({
      pubKey: this.authPubKey
    });
  }

  async getAddresses() {
    const walletAddresses = await this.client.getAddresses({
      pubKey: this.authPubKey
    });
    return walletAddresses.map(walletAddress => walletAddress.address);
  }

  async deriveAddress(addressIndex, isChange) {
    const address = Deriver.deriveAddress(
      this.chain,
      this.network,
      this.xPubKey,
      addressIndex,
      isChange
    );
    return address;
  }

  async derivePrivateKey(isChange) {
    const keyToImport = await Deriver.derivePrivateKey(
      this.chain,
      this.network,
      this.unlocked.masterKey,
      this.addressIndex || 0,
      isChange
    );
    return keyToImport;
  }

  async nextAddressPair(withChangeAddress?: boolean) {
    this.addressIndex = this.addressIndex || 0;
    const newPrivateKey = await this.derivePrivateKey(false);
    const keys = [newPrivateKey];
    if (withChangeAddress) {
      const newChangePrivateKey = await this.derivePrivateKey(true);
      keys.push(newChangePrivateKey);
    }
    this.addressIndex++;
    await this.importKeys({ keys });
    await this.saveWallet();
    return keys.map(key => key.address.toString());
  }

  async getNonce(addressIndex: number = 0, isChange?: boolean) {
    const address = await this.deriveAddress(0, isChange);
    const count = await this.client.getNonce({ address });
    if (!count || !count.nonce) {
      throw new Error('Unable to get nonce');
    }
    return count.nonce;
  }
}
