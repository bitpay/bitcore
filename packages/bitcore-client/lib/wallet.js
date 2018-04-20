const Mnemonic = require('bitcore-mnemonic');
const bitcoreLib = require('bitcore-lib');
const Client = require('./client');
const Storage = require('./storage');

class Wallet {
  constructor(params) {
    Object.assign(this, params);
    if (!this.masterKey) {
      return new Wallet(this.create(params));
    }
    this.baseUrl = this.baseUrl || `http://127.0.0.1:3000/api/${this.chain}/${this.network}`;
    this.client = new Client({ baseUrl: this.baseUrl, authKey: this.getAuthSigningKey() });
  }

  saveWallet(){
    return this.storage.saveWallet({ wallet: this });
  }

  static async create(params){
    const { chain, network, name, phrase, password, path } = params;
    if (!chain || !network || !name || !path){
      throw new Error('Missing required parameter');
    }
    const mnemonic = new Mnemonic(phrase);
    const privateKey = mnemonic.toHDPrivateKey(password);
    const masterKey = Object.assign(privateKey.toObject(), privateKey.hdPublicKey.toObject());
    const storage = new Storage({ path, errorIfExists: true, createIfMissing: true });
    const wallet = Object.assign(params, {
      masterKey,
      mnemonic: mnemonic.toString()
    });
    await storage.saveWallet({wallet});
    const loadedWallet = await this.loadWallet({path, storage});
    loadedWallet.register();
    return loadedWallet;
  }

  static async loadWallet(params) {
    const { path } = params;
    const storage = params.storage || new Storage({ path, errorIfExists: false, createIfMissing: false});
    const loadedWallet = await storage.loadWallet();
    return new Wallet(Object.assign(loadedWallet, {storage}));
  }

  async register(params={}){
    const {baseUrl} = params;
    if (baseUrl){
      this.baseUrl = baseUrl;
      await this.saveWallet();
    }
    const payload = {
      name: this.name,
      pubKey: this.masterKey.xpubkey,
      path: this.derivationPath,
      network: this.network,
      chain: this.chain
    };
    return this.client.register({ payload });
  }

  getAuthSigningKey(){
    return new bitcoreLib.HDPrivateKey(this.masterKey.xprivkey).deriveChild('m/2').privateKey;
  }

  getBalance(params){
    return this.client.getBalance({ pubKey: this.masterKey.xpubkey })
  }

  getUtxos(params){
    return this.client.getCoins({ pubKey: this.masterKey.xpubkey, includeSpent: false });
  }

  async broadcast(params){
    const payload = {
      network: this.network,
      chain: this.chain,
      rawTx: params.rawTx
    }
    return this.client.broadcast({payload});
  }

  async importKeys(params){
    const {keys} = params;
    for (const key of keys) {
      await this.storage.addKey({key});
      
    }
    const payload = keys.map((key) => { return { address: key.address } });
    await this.client.importAddresses({ pubKey: this.masterKey.xpubkey, payload});
  }
}

module.exports = Wallet;
