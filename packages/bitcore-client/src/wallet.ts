import * as Bcrypt from 'bcryptjs';
import { Encryption } from './encryption';
import { Client } from './client';
import { Storage } from './storage';
import { Request } from 'request';
import TxProvider from './providers/tx-provider';
import { AddressProvider } from './providers/address-provider/deriver';
import { ParseApiStream } from './stream-util';
import { numberToHex } from 'web3-utils/types';
import { cursorTo } from 'readline';
const { PrivateKey } = require('bitcore-lib');
const Mnemonic = require('bitcore-mnemonic');

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
  apiUrl: string;
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
  addressIndex: number;
  authKey: string;
  derivationPath: string;

  constructor(params: Wallet | Wallet.WalletObj) {
    Object.assign(this, params);
    if (this.baseUrl) {
      this.apiUrl = `${this.baseUrl}/${this.chain}/${this.network}`;
    } else {
      this.apiUrl = `https://api.bitcore.io/api/${this.chain}/${this.network}`;
    }
    this.client = new Client({
      baseUrl: this.apiUrl,
      authKey: this.getAuthSigningKey()
    });
  }

  saveWallet() {
    const walletInstance = Object.assign({}, this);
    delete walletInstance.unlocked;
    return this.storage.saveWallet({ wallet: walletInstance });
  }

  static async create(params: Partial<Wallet.WalletObj>) {
    const { chain, network, name, phrase, password, path, baseUrl } = params;
    let { storage } = params;
    if (!chain || !network || !name) {
      throw new Error('Missing required parameter');
    }
    // Generate wallet private keys
    const mnemonic = new Mnemonic(phrase);
    const hdPrivKey = mnemonic
      .toHDPrivateKey()
      .derive(AddressProvider.pathFor(chain, network));
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
      baseUrl,
      addressIndex: 0,
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
    await loadedWallet.register({ baseUrl }).catch(e => {
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
    let registerBaseUrl = this.apiUrl;
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

  getBalance(time?:string) {
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
    fee?: number;
  }) {
    console.log('using index', this.addressIndex, 'for change');

    const payload = {
      network: this.network,
      chain: this.chain,
      recipients: params.recipients,
      from: params.from,
      change: params.change,
      fee: params.fee,
      wallet: this,
      utxos: params.utxos
    };
    return TxProvider.create(payload);
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
    let { tx, from } = params;
    const payload = {
      chain: this.chain,
      network: this.network,
      tx,
      utxos: params.utxos,
      from
    };

    return TxProvider.sign({ ...payload, wallet: this });
  }

  async checkWallet() {
    return this.client.checkWallet({
      pubKey: this.authPubKey
    });
  }

  getAddresses() {
    return this.client.getAddresses({
      pubKey: this.authPubKey
    });
  }

  async deriveAddress(addressIndex, isChange) {
    const address = AddressProvider.derive(
      this.chain,
      this.network,
      this.xPubKey,
      addressIndex,
      isChange
    );
    return address;
  }

  async derivePrivateKey(isChange) {
    const keyToImport = await AddressProvider.derivePrivateKey(
      this.chain,
      this.network,
      this.unlocked.masterKey,
      this.addressIndex,
      isChange
    );
    await this.importKeys({ keys: [keyToImport] });
    return keyToImport.address.toString();
  }

  async nextAddressPair() {
    this.addressIndex =
      this.addressIndex !== undefined ? this.addressIndex + 1 : 0;
    const newAddress = await this.derivePrivateKey(false);
    const newChangeAddress = await this.derivePrivateKey(true);
    await this.saveWallet();
    return [newAddress, newChangeAddress];
  }
}
