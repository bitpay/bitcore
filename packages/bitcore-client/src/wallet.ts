import * as Bcrypt from 'bcrypt';
import { Encryption } from './encryption';
import { Client } from './client';
import { Storage } from './storage';
import { Request } from 'request';
import TxProvider from './providers/tx-provider';
import { BIP44Codes } from './constants/bip44';
import { AddressProvider, AddressConverters } from './providers/address-provider';
const Mnemonic = require('bitcore-mnemonic');
const { PrivateKey, HDPrivateKey } = require('bitcore-lib');

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
    currencies: Array<{ chain; network }>;
  };
}
export class Wallet {
  masterKey: any;
  baseUrl: string;
  client: Client;
  storage: Storage;
  unlocked?: { encryptionKey: string; masterKey: { xprivkey: string } };
  password: string;
  encryptionKey: string;
  authPubKey: string;
  pubKey: string;
  name: string;
  path: string;
  authKey: string;
  derivationPath: string;
  currencies: Array<{ chain; network }>;

  constructor(params: Wallet | Wallet.WalletObj) {
    Object.assign(this, params);
    if (!this.baseUrl) {
      this.baseUrl = `https://api.bitcore.io/api`;
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
    if (!name) {
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
      xPubKey: hdPubKey.xpubkey,
      pubKey,
      currencies: [{ chain, network }]
    });
    // save wallet to storage and then bitcore-node
    await storage.saveWallet({ wallet });
    const loadedWallet = await this.loadWallet({
      storage,
      name
    });
    console.log(mnemonic.toString());
    if (chain && network) {
      await loadedWallet.register({ chain, network }).catch(e => {
        console.debug(e);
        console.error('Failed to register wallet with bitcore-node.');
      });
    }
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

  async enableCurrency(chain: string, network: string) {
    this.currencies.push({ chain, network });
    await this.saveWallet();
  }

  async deriveAddress(
    currencyCode: keyof typeof AddressConverters,
    account = 0,
    change = 0,
    address_index = 0
  ) {
    const privKey = await this.bip44CodeDerive(
      currencyCode,
      account,
      change,
      address_index
    );
    const pubKey = privKey.publicKey;
    const address = AddressProvider.fromPublicKey({
      pubKey,
      currency: currencyCode
    });
    return address;
  }

  async bip44CodeDerive(
    currencyCode: keyof typeof BIP44Codes,
    account: number,
    change: number,
    address_index: number
  ) {
    const coin_type = BIP44Codes[currencyCode];
    const path = `m/44'/${coin_type}/${account}'/${change}/${address_index}`;
    const hdKey = new HDPrivateKey(this.unlocked.masterKey.xprivkey);
    return hdKey.derive(path);
  }

  // m / 44' / coin_type' / account' / change / address_index
  async bip44Derive(
    coin_type: number,
    account: number,
    change: boolean,
    address_index: number
  ) {
    const path = `m/44'/${coin_type}'/${account}'/${change}/${address_index}`;
    const hdKey = new HDPrivateKey(this.unlocked.masterKey.xprivkey);
    return hdKey.derive(path);
  }

  async register(params: { baseUrl?: string; chain: string; network: string }) {
    const { baseUrl, chain, network } = params;
    let registerBaseUrl = this.baseUrl;
    if (baseUrl) {
      // save the new url without chain and network
      // then use the new url with chain and network below
      this.baseUrl = baseUrl;
      registerBaseUrl = `${this.baseUrl}/${chain}/${network}`;
      await this.saveWallet();
    }
    const payload = {
      name: this.name,
      pubKey: this.authPubKey,
      path: this.derivationPath,
      network: network,
      chain: chain,
      baseUrl: registerBaseUrl
    };
    return this.client.register(payload);
  }

  getAuthSigningKey() {
    return new PrivateKey(this.authKey);
  }

  getBalance({ chain, network }) {
    return this.client.getBalance({ chain, network, pubKey: this.authPubKey });
  }

  getNetworkFee({ chain, network, target }) {
    return this.client.getFee({ chain, network, target });
  }

  getUtxos(params: { chain: string; network: string; includeSpent?: boolean }) {
    const { includeSpent = false, chain, network } = params;
    return this.client.getCoins({
      chain,
      network,
      pubKey: this.authPubKey,
      includeSpent
    });
  }

  listTransactions({
    chain,
    network,
    startBlock,
    startDate,
    endBlock,
    endDate,
    includeMempool
  }) {
    return this.client.listTransactions({
      chain,
      network,
      startBlock,
      startDate,
      endBlock,
      endDate,
      includeMempool,
      pubKey: this.authPubKey
    });
  }

  async newTx({
    utxos,
    chain,
    network,
    recipients,
    change,
    fee,
    includeSpent
  }) {
    const tUtxos = utxos || (await this.getUtxos({ chain, network }));
    const payload = {
      network: network,
      chain: chain,
      recipients: recipients,
      change: change,
      fee: fee,
      utxos
    };
    return TxProvider.create(payload);
  }

  async broadcast({ tx, chain, network }) {
    const payload = {
      network: network,
      chain: chain,
      rawTx: tx
    };
    return this.client.broadcast({ payload });
  }
  async importKeys(params: {
    keys: Partial<Wallet.KeyImport>[];
    chain: string;
    network: string;
  }) {
    const { keys, chain, network } = params;
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
      chain,
      network,
      pubKey: this.authPubKey,
      payload: addedAddresses
    });
  }

  async signTx({ tx, utxos, chain, network }) {
    const tUtxos = utxos || (await this.getUtxos({ chain, network }));
    const payload = {
      chain: chain,
      network: network,
      tx,
      utxos: tUtxos
    };
    const { encryptionKey } = this.unlocked;
    let inputAddresses = TxProvider.getSigningAddresses(payload);
    let keyPromises = inputAddresses.map(address => {
      return this.storage.getKey({
        address,
        encryptionKey,
        chain: chain,
        network: network,
        name: this.name
      });
    });
    let keys = await Promise.all(keyPromises);
    return TxProvider.sign({ ...payload, keys });
  }
}
