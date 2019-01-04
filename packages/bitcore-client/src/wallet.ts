import * as Bcrypt from 'bcrypt';
import { Encryption } from './encryption';
import { Client } from './client';
import { Storage } from './storage';
import { Request } from 'request';
import TxProvider from './providers/tx-provider';
const Mnemonic = require('bitcore-mnemonic');
const { PrivateKey } = require('bitcore-lib');

export namespace Wallet {
  export type KeyImport = {
    address: string;
    privKey: string;
    pubKey: string;
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
  name: string;
  path: string;
  authKey: string;
  derivationPath: string;

  constructor(params: Wallet | Wallet.WalletObj) {
    Object.assign(this, params);
    if (this.baseUrl) {
      this.baseUrl = `${this.baseUrl}/${this.chain}/${this.network}`;
    } else {
      this.baseUrl = `https://api.bitcore.io/api/${this.chain}/${this.network}`;
    }
    this.client = new Client({
      baseUrl: this.baseUrl,
      authKey: this.getAuthSigningKey()
    });
  }

  saveWallet() {
    this.lock();
    return this.storage.saveWallet({ wallet: this });
  }

  static async create(params: Partial<Wallet.WalletObj>) {
    const { chain, network, name, phrase, password, path } = params;
    let { storage } = params;
    if (!chain || !network || !name) {
      throw new Error('Missing required parameter');
    }
    // Generate wallet private keys
    const mnemonic = new Mnemonic(phrase);
    const hdPrivKey = mnemonic.toHDPrivateKey(password);
    const privKeyObj = hdPrivKey.toObject();

    // Generate authentication keys
    const authKey = new PrivateKey();
    const authPubKey = authKey.toPublicKey().toString();

    // Generate public keys
    const hdPubKey = hdPrivKey.hdPublicKey;
    const pubKey = hdPubKey.publicKey.toString();

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
      alreadyExists = await this.loadWallet({ storage, name, chain, network });
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
      xPubKey: hdPubKey.xpubkey,
      pubKey
    });
    // save wallet to storage and then bitcore-node
    await storage.saveWallet({ wallet });
    const loadedWallet = await this.loadWallet({
      storage,
      name,
      chain,
      network
    });
    console.log(mnemonic.toString());
    await loadedWallet.register().catch(e => {
      console.debug(e);
      console.error('Failed to register wallet with bitcore-node.');
    });
    return loadedWallet;
  }

  static async exists(params) {
    const { storage, name, chain, network } = params;
    let alreadyExists;
    try {
      alreadyExists = await Wallet.loadWallet({
        storage,
        name,
        chain,
        network
      });
    } catch (err) {}
    return alreadyExists != undefined;
  }

  static async loadWallet(params) {
    const { chain, network, name, path } = params;
    let { storage } = params;
    storage =
      storage ||
      new Storage({ errorIfExists: false, createIfMissing: false, path });
    const loadedWallet = await storage.loadWallet({ chain, network, name });
    return new Wallet(Object.assign(loadedWallet, { storage }));
  }

  lock() {
    this.unlocked = undefined;
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
    let registerBaseUrl = this.baseUrl;
    if (baseUrl) {
      // save the new url without chain and network
      // then use the new url with chain and network below
      this.baseUrl = baseUrl;
      registerBaseUrl = `${this.baseUrl}/${this.chain}/${this.network}`;
      await this.saveWallet();
    }
    const payload = {
      name: this.name,
      pubKey: this.authPubKey,
      path: this.derivationPath,
      network: this.network,
      chain: this.chain,
      baseUrl: registerBaseUrl
    };
    return this.client.register({ payload });
  }

  getAuthSigningKey() {
    return new PrivateKey(this.authKey);
  }

  getBalance() {
    return this.client.getBalance({ pubKey: this.authPubKey });
  }

  getNetworkFee(params) {
    const target = params.target || 2;
    return this.client.getFee({ target });
  }

  getUtxos(params: {includeSpent?: boolean} = {}) {
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

  async newTx(params) {
    const utxos = params.utxos || (await this.getUtxos(params));
    const payload = {
      network: this.network,
      chain: this.chain,
      recipients: params.recipients,
      change: params.change,
      fee: params.fee,
      utxos
    };
    return TxProvider.create(payload);
  }

  async broadcast(params) {
    const payload = {
      network: this.network,
      chain: this.chain,
      rawTx: params.tx
    };
    return this.client.broadcast({ payload });
  }
  async importKeys(params: { keys: Partial<Wallet.KeyImport>[] }) {
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
    let { tx } = params;
    const utxos = params.utxos || (await this.getUtxos(params));
    const payload = {
      chain: this.chain,
      network: this.network,
      tx,
      utxos
    };
    const { encryptionKey } = this.unlocked;
    let inputAddresses = TxProvider.getSigningAddresses(payload);
    let keyPromises = inputAddresses.map(address => {
      return this.storage.getKey({
        address,
        encryptionKey,
        chain: this.chain,
        network: this.network,
        name: this.name
      });
    });
    let keys = await Promise.all(keyPromises);
    return TxProvider.sign({ ...payload, keys });
  }

  async checkWallet() {
    return this.client.checkWallet({
      pubKey: this.authPubKey
    });
  }
}
