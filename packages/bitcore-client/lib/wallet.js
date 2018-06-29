const Bcrypt = require('bcrypt');
const Encrypter = require('./encryption');
const Mnemonic = require('bitcore-mnemonic');
const bitcoreLib = require('bitcore-lib');
const Client = require('./client');
const Storage = require('./storage');
const txProvider = require('../lib/providers/tx-provider');
const config = require('./config');

class Wallet {
  constructor(params) {
    Object.assign(this, params);
    if (!this.masterKey) {
      return new Wallet(this.create(params));
    }
    this.baseUrl = this.baseUrl || `http://127.0.0.1:3000/api/${this.chain}/${this.network}`;
  }

  saveWallet() {
    this.lock();
    return this.storage.saveWallet({ wallet: this });
  }

  static async create(params) {
    const { chain, network, name, phrase, password, path } = params;
    if (!chain || !network || !name || !path) {
      throw new Error('Missing required parameter');
    }
    const mnemonic = new Mnemonic(phrase);
    const privateKey = mnemonic.toHDPrivateKey(password);
    const pubKey = privateKey.hdPublicKey.publicKey.toString();
    const walletEncryptionKey = Encrypter.generateEncryptionKey();
    const keyObj = Object.assign(privateKey.toObject(), privateKey.hdPublicKey.toObject());
    const encryptionKey = Encrypter.encryptEncryptionKey(walletEncryptionKey, password);
    const encPrivateKey = Encrypter.encryptPrivateKey(JSON.stringify(keyObj), pubKey, walletEncryptionKey);
    const storage = new Storage({
      path,
      errorIfExists: true,
      createIfMissing: true
    });
    const wallet = Object.assign(params, {
      encryptionKey,
      masterKey: encPrivateKey,
      password: await Bcrypt.hash(password, 10),
      xPubKey: keyObj.xpubkey,
      pubKey
    });
    await storage.saveWallet({ wallet });
    config.addWallet(path);
    const loadedWallet = await this.loadWallet({ path, storage });
    await loadedWallet.unlock(password);
    await loadedWallet.register();
    return loadedWallet;
  }

  static async loadWallet(params) {
    const { path } = params;
    const storage = params.storage || new Storage({ path, errorIfExists: false, createIfMissing: false });
    const loadedWallet = await storage.loadWallet();
    return new Wallet(Object.assign(loadedWallet, { storage }));
  }

  lock() {
    this.unlocked = undefined;
  }

  async unlock(password) {
    const encMasterKey = this.masterKey;
    let validPass = await Bcrypt.compare(password, this.password).catch(() => false);
    if (!validPass) {
      throw new Error('Incorrect Password');
    }
    const encryptionKey = await Encrypter.decryptEncryptionKey(this.encryptionKey, password);
    const masterKeyStr = await Encrypter.decryptPrivateKey(encMasterKey, this.pubKey, encryptionKey);
    const masterKey = JSON.parse(masterKeyStr);
    this.unlocked = {
      encryptionKey,
      masterKey
    };
    this.client = new Client({
      baseUrl: this.baseUrl,
      authKey: this.getAuthSigningKey()
    });

    return this;
  }

  async register(params = {}) {
    const { baseUrl } = params;
    if (baseUrl) {
      this.baseUrl = baseUrl;
      await this.saveWallet();
    }
    const payload = {
      name: this.name,
      pubKey: this.unlocked.masterKey.xpubkey,
      path: this.derivationPath,
      network: this.network,
      chain: this.chain
    };
    return this.client.register({ payload });
  }

  getAuthSigningKey() {
    return new bitcoreLib.HDPrivateKey(this.unlocked.masterKey.xprivkey).deriveChild('m/2').privateKey;
  }

  getBalance() {
    const { masterKey } = this.unlocked;
    return this.client.getBalance({ pubKey: masterKey.xpubkey });
  }

  getUtxos() {
    const { masterKey } = this.unlocked;
    return this.client.getCoins({
      pubKey: masterKey.xpubkey,
      includeSpent: false
    });
  }

  async newTx(params) {
    const utxos = params.utxos || (await this.getUtxos(params));
    const payload = {
      network: this.network,
      chain: this.chain,
      addresses: params.addresses,
      amount: params.amount,
      change: params.change,
      fee: params.fee,
      utxos
    };
    return txProvider.create(payload);
  }

  async broadcast(params) {
    const payload = {
      network: this.network,
      chain: this.chain,
      rawTx: params.tx
    };
    return this.client.broadcast({ payload });
  }

  async importKeys(params) {
    const { keys } = params;
    const { encryptionKey } = this.unlocked;
    for (const key of keys) {
      let keyToSave = { key, encryptionKey };
      await this.storage.addKey(keyToSave);
    }
    const addedAddresses = keys.map(key => {
      return { address: key.address };
    });
    if (this.unlocked) {
      return this.client.importAddresses({
        pubKey: this.xPubKey,
        payload: addedAddresses
      });
    }
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
    let inputAddresses = txProvider.getSigningAddresses(payload);
    let keyPromises = inputAddresses.map(address => {
      return this.storage.getKey({
        address,
        encryptionKey
      });
    });
    let keys = await Promise.all(keyPromises);
    return txProvider.sign({ ...payload, keys });
  }
}

module.exports = Wallet;
