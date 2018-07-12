const Bcrypt = require('bcrypt');
const Encrypter = require('./encryption');
const Mnemonic = require('bitcore-mnemonic');
const Client = require('./client');
const Storage = require('./storage');
const txProvider = require('../lib/providers/tx-provider');

class Wallet {
  constructor(params) {
    Object.assign(this, params);
    if (!this.masterKey) {
      return new Wallet(this.create(params));
    }
    if(this.baseUrl) {
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

  static async create(params) {
    const { chain, network, name, phrase, password, path } = params;
    let { storage } = params;
    if (!chain || !network || !name) {
      throw new Error('Missing required parameter');
    }
    // Generate private keys
    const mnemonic = new Mnemonic(phrase);
    const hdPrivKey = mnemonic.toHDPrivateKey(password);
    const privKeyObj = hdPrivKey.toObject();
    const authKey = hdPrivKey.deriveChild('m/2').privateKey.toString();

    // Generate public keys
    const hdPubKey = hdPrivKey.hdPublicKey;
    const pubKey = hdPrivKey.hdPublicKey.publicKey.toString();

    // Generate and encrypt the encryption key and private key
    const walletEncryptionKey = Encrypter.generateEncryptionKey();
    const encryptionKey = Encrypter.encryptEncryptionKey(walletEncryptionKey, password);
    const encPrivateKey = Encrypter.encryptPrivateKey(JSON.stringify(privKeyObj), pubKey, walletEncryptionKey);

    storage = storage || new Storage({
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
      masterKey: encPrivateKey,
      password: await Bcrypt.hash(password, 10),
      xPubKey: hdPubKey.xpubkey,
      pubKey
    });
    // save wallet to storage and then bitcore-node
    await storage.saveWallet({ wallet });
    const loadedWallet = await this.loadWallet({ storage, name, chain, network });
    console.log(mnemonic.toString());
    await loadedWallet.register().catch((e) => {
      console.debug(e);
      console.error('Failed to register wallet with bitcore-node.');
    });
    return loadedWallet;
  }

  static async loadWallet(params) {
    const { chain, network, name, path } = params;
    let { storage } = params;
    storage = storage || new Storage({ errorIfExists: false, createIfMissing: false, path });
    const loadedWallet = await storage.loadWallet({ chain, network, name });
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
      pubKey: this.xPubKey,
      path: this.derivationPath,
      network: this.network,
      chain: this.chain
    };
    return this.client.register({ payload });
  }

  getAuthSigningKey() {
    return this.authKey;
  }

  getBalance() {
    return this.client.getBalance({ pubKey: this.xPubKey});
  }

  getNetworkFee(params) {
    const target = params.target || 2;
    return this.client.getFee({ target });
  }

  getUtxos() {
    return this.client.getCoins({
      pubKey: this.xPubKey,
      includeSpent: false
    });
  }

  listTransactions(params) {
    return this.client.listTransactions({
      ...params,
      pubKey: this.xPubKey
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
    const keysToSave = keys.filter(key => typeof key.privKey === 'string');
    if (keysToSave.length) {
      await this.storage.addKeys({ keys: keysToSave, encryptionKey, name: this.name });
    }
    const addedAddresses = keys.map(key => {
      return { address: key.address };
    });
    return this.client.importAddresses({
      pubKey: this.xPubKey,
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
    let inputAddresses = txProvider.getSigningAddresses(payload);
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
    return txProvider.sign({ ...payload, keys });
  }
}

module.exports = Wallet;
