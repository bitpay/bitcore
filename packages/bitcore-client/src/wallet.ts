import 'source-map-support/register';
import * as Bcrypt from 'bcrypt';
import { 
  BitcoreLib,
  BitcoreLibCash,
  BitcoreLibDoge,
  BitcoreLibLtc,
  Constants,
  Deriver,
  ethers,
  SolanaProgram,
  SolKit,
  Transactions,
  Web3,
  xrpl
} from 'crypto-wallet-core';
import { BumpTxFeeType, IWallet, KeyImport } from './types/wallet';
import { Client } from './client';
import { Encryption } from './encryption';
import Mnemonic from 'bitcore-mnemonic';
import { ParseApiStream } from './stream-util';
import { Storage } from './storage';
import { StorageType } from './types/storage';

const { PrivateKey, HDPrivateKey } = BitcoreLib;
const chainLibs = {
  BTC: BitcoreLib,
  BCH: BitcoreLibCash,
  DOGE: BitcoreLibDoge,
  LTC: BitcoreLibLtc,
  ETH: { Web3, ethers },
  MATIC: { Web3, ethers },
  ARB: { Web3, ethers },
  BASE: { Web3, ethers },
  OP: { Web3, ethers },
  XRP: xrpl,
  SOL: { SolKit, SolanaProgram }
};

export interface IWalletExt extends IWallet {
  storage?: Storage;
}

export class Wallet {
  masterKey?: any;
  baseUrl: string;
  chain: string;
  network: string;
  client: Client;
  storage: Storage;
  storageType: string;
  unlocked?: { encryptionKey: string; masterKey: string };
  password: string;
  encryptionKey: string;
  authPubKey: string;
  pubKey?: string;
  xPubKey: string;
  name: string;
  path: string;
  addressIndex?: number;
  authKey: string;
  derivationPath: string;
  tokens?: Array<any>;
  lite: boolean;
  addressType: string;
  addressZero: string;

  static XrpAccountFlags = xrpl.AccountSetTfFlags;

  constructor(params: Wallet | IWalletExt) {
    Object.assign(this, params);
    if (!this.baseUrl) {
      this.baseUrl = 'https://api.bitcore.io/api';
    }
    this.client = new Client({
      apiUrl: this.getApiUrl(),
      authKey: this.getAuthSigningKey()
    });
    this.addressIndex = this.addressIndex || 0;
    this.addressType = AddressTypes[this.chain]?.[this.addressType] || 'pubkeyhash';
    if (params.lite) {
      delete this.masterKey;
      delete this.pubKey;
      this.lite = true;
    }
  }

  getApiUrl() {
    return `${this.baseUrl}/${this.chain}/${this.network}`;
  }

  getLib() {
    return chainLibs[this.chain.toUpperCase()];
  }

  saveWallet() {
    const walletInstance = Object.assign({}, this);
    delete walletInstance.unlocked;
    if (walletInstance.masterKey) {
      walletInstance.lite = false;
    }
    return this.storage.saveWallet({ wallet: walletInstance });
  }

  toObject(lite: boolean = this.lite) {
    return {
      name: this.name,
      chain: this.chain,
      network: this.network,
      path: this.path,
      baseUrl: this.baseUrl,
      encryptionKey: this.encryptionKey,
      authKey: this.authKey,
      authPubKey: this.authPubKey,
      masterKey: lite ? undefined : this.masterKey,
      password: Bcrypt.hashSync(this.password, 10),
      xPubKey: this.xPubKey,
      pubKey: lite ? undefined : this.pubKey,
      tokens: this.tokens,
      storageType: this.storageType,
      lite,
      addressType: this.addressType,
      addressZero: this.addressZero
    };
  }

  static async deleteWallet(params: { name: string; path?: string; storage?: Storage; storageType?: StorageType }) {
    const { name, path, storageType } = params;
    let { storage } = params;
    storage = storage || new Storage({ errorIfExists: false, createIfMissing: false, path, storageType });
    await storage.deleteWallet({ name });
  }

  static async create(params: Partial<IWalletExt>) {
    const { network, name, phrase, xpriv, password, path, lite, baseUrl } = params;
    let { chain, storageType, storage, addressType } = params;
    if (phrase && xpriv) {
      throw new Error('You can only provide either a phrase or a xpriv, not both');
    }
    if (!chain || !network || !name) {
      throw new Error('Missing required parameter');
    }
    chain = chain.toUpperCase();
    if (addressType && AddressTypes[chain] && !AddressTypes[chain]?.[addressType]) {
      throw new Error(`Invalid --addressType for chain. Valid address types are: ${Object.keys(AddressTypes[chain]).join(' | ')}`);
    }
    addressType = AddressTypes[chain]?.[addressType] || 'pubkeyhash';

    // Generate wallet private keys
    let hdPrivKey;
    let mnemonic;
    if (xpriv) {
      hdPrivKey = new HDPrivateKey(xpriv, network);
    } else {
      mnemonic = new Mnemonic(phrase);
      const algo = Constants.ALGOS_BY_CHAIN[chain] || Constants.ALGOS_BY_CHAIN['default'];
      const keyType = Constants.ALGO_TO_KEY_TYPE[algo];
      hdPrivKey = mnemonic.toHDPrivateKey('', network).derive(Deriver.pathFor(chain, network), keyType);
    }
    const privKeyObj = hdPrivKey.toObject();

    // Generate authentication keys
    const authKey = new PrivateKey();
    const authPubKey = authKey.toPublicKey().toString();

    // Generate public keys
    // bip44 compatible pubKey
    const pubKey = hdPrivKey.publicKey.toString();

    // Generate and encrypt the encryption key and private key
    const walletEncryptionKey = Encryption.generateEncryptionKey();
    const encryptionKey = Encryption.encryptEncryptionKey(walletEncryptionKey, password);
    const encPrivateKey = Encryption.encryptPrivateKey(JSON.stringify(privKeyObj), pubKey, walletEncryptionKey);

    storageType = storageType ? storageType : 'Level';
    storage =
      storage ||
      new Storage({
        path,
        errorIfExists: false,
        createIfMissing: true,
        storageType
      });

    let alreadyExists;
    try {
      alreadyExists = await this.loadWallet({ storage, name, storageType });
    } catch { /* ignore */ }
    if (alreadyExists) {
      throw new Error('Wallet already exists');
    }
    const wallet = new Wallet({
      name,
      chain,
      network,
      path,
      baseUrl,
      encryptionKey,
      authKey,
      authPubKey,
      masterKey: encPrivateKey,
      password,
      xPubKey: hdPrivKey.xpubkey,
      pubKey,
      tokens: [],
      storage,
      storageType,
      lite,
      addressType,
      addressZero: null
    } as IWalletExt);

    // save wallet to storage and then bitcore-node
    await storage.saveWallet({ wallet: wallet.toObject(lite) });
    const loadedWallet = await this.loadWallet({
      storage,
      name,
      storageType
    });

    if (!xpriv) {
      console.log(mnemonic.toString());
    } else {
      console.log(hdPrivKey.toString());
    }

    await loadedWallet.register().catch(e => {
      console.debug(e);
      console.error('Failed to register wallet with bitcore-node.');
    });

    return loadedWallet;
  }

  static async exists(params: { name: string; path?: string; storage?: Storage }) {
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
    return alreadyExists != undefined && alreadyExists.length && alreadyExists.length != 0;
  }

  static async loadWallet(params: { name: string; path?: string; storage?: Storage; storageType?: StorageType }) {
    const { name, path, storageType } = params;
    let { storage } = params;
    storage = storage || new Storage({ errorIfExists: false, createIfMissing: false, path, storageType });
    const loadedWallet = await storage.loadWallet({ name });
    if (loadedWallet) {
      return new Wallet(Object.assign(loadedWallet, { storage }));
    } else {
      throw new Error('No wallet could be found');
    }
  }

  /**
   * Does this wallet use UTXOs?
   * @returns {Boolean}
   */
  isUtxoChain() {
    // the toUpperCase() should not be necessary, but it's here just in case.
    return ['BTC', 'BCH', 'DOGE', 'LTC'].includes(this.chain?.toUpperCase() || 'BTC');
  }

  /**
   * Is this wallet EVM compatible?
   * @returns {Boolean}
   */
  isEvmChain() {
    return ['ETH', 'MATIC', 'ARB', 'OP', 'BASE'].includes(this.chain?.toUpperCase());
  }

  isSolanaChain() {
    return ['SOL'].includes(this.chain?.toUpperCase());
  }

  lock() {
    this.unlocked = undefined;
    return this;
  }

  async unlock(password) {
    const validPass = await Bcrypt.compare(password, this.password).catch(() => false);
    if (!validPass) {
      throw new Error('Incorrect Password');
    }
    const encryptionKey = await Encryption.decryptEncryptionKey(this.encryptionKey, password);
    let masterKey;
    if (!this.lite) {
      const encMasterKey = this.masterKey;
      const masterKeyStr = await Encryption.decryptPrivateKey(encMasterKey, this.pubKey, encryptionKey);
      masterKey = JSON.parse(masterKeyStr);
    }
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

  /**
   * Get balance for the wallet
   * @param params
   * @param params.time Get balance at point in time
   * @param params.token DEPRECATED: Token to get by ticker symbol. WARNING: there could be multiple tokens with the same symbol
   * @param params.tokenName Token to get by tokenName (Recommended over `token`)
   * @param params.address EVM Account address to get the balance for
   * @param params.hex Return the balance in hex
   * @returns 
   */
  getBalance(params: { time?: string, token?: string, tokenName?: string, address?: string; hex?: boolean } = {}) {
    const { time, token, tokenName, address, hex } = params;
    let payload;
    if (token || tokenName) {
      const tokenObj = this.getTokenObj({ token, tokenName });
      payload = {
        tokenContractAddress: tokenObj.address
      };
    }
    return this.client.getBalance({ payload, pubKey: this.authPubKey, time, address, hex });
  }

  getNetworkFee(params: { target?: number, txType?: number } = {}) {
    const target = params.target || 2;
    const txType = params.txType;
    return this.client.getFee({ target, txType });
  }

  getNetworkPriorityFee(params: { percentile?: number } = {}) {
    const percentile = params.percentile;
    return this.client.getPriorityFee({ percentile });
  }

  getUtxos(params: { includeSpent?: boolean } = {}) {
    const { includeSpent = false } = params;
    return this.client.getCoins({
      pubKey: this.authPubKey,
      includeSpent
    });
  }

  getUtxosArray(params: { includeSpent?: boolean } = {}) {
    return new Promise((resolve, reject) => {
      const utxoArray = [];
      const { includeSpent = false } = params;
      const utxoRequest = this.client.getCoins({
        pubKey: this.authPubKey,
        includeSpent
      });
      utxoRequest
        .pipe(new ParseApiStream())
        .on('data', utxo => utxoArray.push(utxo))
        .on('end', () => resolve(utxoArray))
        .on('err', err => reject(err));
    });
  }

  /**
   * Backwards compatible method for getting the token object
   * 
   * `token` and `tokenName` are separate parameters because there are legacy token objects
   * without a `name` but modern implementations try to use the tokenName.
   * e.g.:
   * tokens = [
   *   { token: 'USDC', address: '0x123...', decimals: '6' } // USDC.e
   *   { token: 'USDC', address: '0xabc...', decimals: '6', name: 'USDCn_m' } // native USDC
   * ]
   * params1 = { token: 'USDC', tokenName: 'USDC_m' } => returns tokens[0]
   * params2 = { token: 'USDC', tokenName: 'USDCn_m' } => returns tokens[1]
   * 
   * 
   * @param tokenName The `name` field on the token object
   * @param token The `symbol` field on the token object (deprecated)
   */
  getTokenObj(params: { tokenName?: string, token?: string }) {
    const { tokenName, token } = params || {};
    if (!tokenName && !token) {
      return null;
    }
    // If tokenName was given, find the token by name (e.g. USDC_m)
    let tokenObj = tokenName && this.tokens.find(tok => tok.name === tokenName);
    // If not found by name AND token was given, find the token by symbol (e.g. USDC)
    // NOTE: we don't want to 
    tokenObj = tokenObj || (token && this.tokens.find(tok => tok.symbol === token && [token, undefined].includes(tok.name)));
    if (!tokenObj) {
      throw new Error(`${tokenName || token} not found on wallet ${this.name}`);
    }
    return tokenObj;
  }

  listTransactions(params) {
    const { token, tokenName } = params;
    if (token || tokenName) {
      const tokenObj = this.getTokenObj({ token, tokenName });
      params.tokenContractAddress = tokenObj.address;
    }
    return this.client.listTransactions({
      ...params,
      pubKey: this.authPubKey
    });
  }

  async getToken(contractAddress) {
    if (this.isSolanaChain()) {
      const addresses = await this.client.getSolanaTokens(this.addressZero);
      return addresses.find(addr => addr.mintAddress === contractAddress);
    }
    return this.client.getToken(contractAddress);
  }

  async addToken(params) {
    if (!this.tokens) {
      this.tokens = [];
    }
    this.tokens.push({
      symbol: params.symbol,
      address: params.address,
      decimals: params.decimals,
      name: params.name,
      ataAddress: params.ataAddress
    });
    await this.saveWallet();
  }

  async rmToken({ tokenName }) {
    if (!this.tokens) {
      return;
    }
    this.tokens = this.tokens.filter(tok => 
      (tok.name && tok.name !== tokenName) ||
      /* legacy object */ (!tok.name && tok.symbol !== tokenName)
    );
    await this.saveWallet();
  }

  async newTx(params: {
    utxos?: any[];
    recipients: { address: string; amount: number }[];
    from?: string;
    change?: string; // 'miner' to have any change go to the miner (i.e. no change).
    invoiceID?: string;
    memo?: string;
    fee?: number;
    feeRate?: number;
    nonce?: number;
    tag?: number;
    data?: string;
    token?: string; // deprecated. tokenName is better, but old token objects don't have the `name` field.
    tokenName?: string;
    gasLimit?: number;
    gasPrice?: number;
    contractAddress?: string;
    chainId?: number;
    replaceByFee?: boolean;
    lockUntilBlock?: number;
    lockUntilDate?: Date;
    isSweep?: boolean;
    type?: string;
    flags?: number;
    blockHash?: string;
    blockHeight?: number;
  }) {
    let chain = this.chain;
    let tokenContractAddress;
    let decimals;
    let fromAta;
    if (params.token || params.tokenName) {
      chain = this.isSolanaChain() ? this.chain + 'SPL' : this.chain + 'ERC20';
      const tokenObj = this.getTokenObj(params);
      tokenContractAddress = tokenObj.address;
      decimals = tokenObj.decimals;
      fromAta = tokenObj.ataAddress;
    }
    let change = params.change;
    if (change === 'miner') {
      change = undefined; // no change
    } else if (!change) {
      change = await this._getChangeAddress();
    }
    let blockHash = params.blockHash;
    let blockHeight = params.blockHeight;
    if (this.isSolanaChain() && (!blockHash || !blockHeight)) {
      const tip = await this.client.getBlockTip();
      blockHash = tip.hash;
      blockHeight = tip.height;
    }
    const payload = {
      network: this.network,
      chain,
      recipients: params.recipients,
      from: params.from,
      change,
      invoiceID: params.invoiceID,
      memo: params.memo,
      fee: params.fee,
      feeRate: params.feeRate,
      utxos: params.utxos,
      nonce: params.nonce,
      tag: params.tag,
      gasPrice: params.gasPrice || params.feeRate || params.fee,
      gasLimit: params.gasLimit || 200000,
      data: params.data,
      tokenAddress: tokenContractAddress,
      contractAddress: params.contractAddress,
      chainId: params.chainId,
      replaceByFee: params.replaceByFee,
      lockUntilBlock: params.lockUntilBlock,
      lockUntilDate: params.lockUntilDate,
      isSweep: params.isSweep,
      type: params.type,
      flags: params.flags,
      blockHash,
      blockHeight,
      decimals,
      fromAta
    };
    return Transactions.create(payload);
  }

  async createAtaAccount(mintAddress) {
    if (!this.isSolanaChain()) {
      throw new Error('createAtaAccount is only supported for Solana wallets');
    }
    const owner = SolKit.address(this.addressZero);
    if (!mintAddress) {
      throw new Error('mintAddress is required to create an associated token account');
    }
    const [newAccount] = await SolanaProgram.Token.findAssociatedTokenPda({
      owner,
      tokenProgram: SolanaProgram.Token.TOKEN_PROGRAM_ADDRESS,
      mint: SolKit.address(mintAddress),
    });
    const tip = await this.client.getBlockTip();
    const blockHash = tip.hash;
    const blockHeight = tip.height;
    const privateKey = await this.derivePrivateKey(null, 0);
    const privKeyBytes = SolKit.getBase58Encoder().encode(privateKey.privKey);
    const keyPair = await SolKit.createKeyPairSignerFromPrivateKeyBytes(privKeyBytes);
    const tx = Transactions.create({
      network: this.network,
      chain: this.chain,
      category: 'createata',
      fromKeyPair: keyPair,
      from: this.addressZero,
      ataAddress: newAccount,
      blockHash,
      blockHeight,
      mint: mintAddress,
    });
    const sig = await this.signTx({ tx });
    await this.broadcast({ tx: sig });
    return sig;
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

  async getTransactionByTxid(params: { txid: string, populated?: boolean }) {
    const { txid, populated } = params;
    return this.client.getTransaction({ txid, populated });
  }

  async importKeys(params: { keys: KeyImport[], rederiveAddys?: boolean }) {
    const { encryptionKey } = this.unlocked;
    const { rederiveAddys } = params;
    let { keys } = params;
    let keysToSave = keys.filter(key => typeof key.privKey === 'string');

    if (rederiveAddys) {
      keysToSave = keysToSave.map(key => ({
        ...key,
        address: key.pubKey ? Deriver.getAddress(this.chain, this.network, key.pubKey, this.addressType) : key.address
      }) as KeyImport);
      keys = keys.map(key => ({
        ...key,
        address: key.pubKey ? Deriver.getAddress(this.chain, this.network, key.pubKey, this.addressType) : key.address
      }) as KeyImport);
    }

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
    const { tx, keys, passphrase, signingKeys, changeAddressIdx } = params;
    let { utxos } = params;
    if (!utxos) {
      utxos = [];
      await new Promise<void>((resolve, reject) => {
        this.getUtxos()
          .pipe(new ParseApiStream())
          .on('data', utxo => utxos.push(utxo))
          .on('end', () => resolve())
          .on('err', err => reject(err));
      });
    }
    let addresses = [];
    let decryptedKeys;
    if (!keys && !signingKeys) {
      for (const utxo of utxos) {
        addresses.push(utxo.address);
      }
      addresses = addresses.length > 0 ? addresses : await this.getAddresses();
      decryptedKeys = await this.storage.getKeys({
        addresses,
        name: this.name,
        encryptionKey: this.unlocked.encryptionKey
      });
    } else if (!signingKeys) {
      addresses.push(keys[0]);
      for (const element of utxos) {
        const keyToDecrypt = keys.find(key => key.address === element.address);
        addresses.push(keyToDecrypt);
      }
      const decryptedParams = Encryption.bitcoinCoreDecrypt(addresses, passphrase);
      decryptedKeys = [...decryptedParams.jsonlDecrypted];
    }
    if (this.isUtxoChain()) {
      // If changeAddressIdx == null, then save the change key at the current addressIndex (just in case)
      const changeKey = await this.derivePrivateKey(true, changeAddressIdx == null ? this.addressIndex : changeAddressIdx);
      await this.importKeys({ keys: [changeKey] });
    }

    const payload = {
      chain: this.chain,
      network: this.network,
      tx,
      keys: signingKeys || decryptedKeys,
      key: signingKeys ? signingKeys[0] : decryptedKeys[0],
      utxos
    };
    return Transactions.sign({ ...payload });
  }

  async checkWallet() {
    return this.client.checkWallet({
      pubKey: this.authPubKey
    });
  }

  async syncAddresses(withChangeAddress = false) {
    const addresses = new Array<string>();
    if (this.addressIndex !== undefined) {
      for (let i = 0; i < this.addressIndex; i++) {
        addresses.push(this.deriveAddress(i, false));
        if (withChangeAddress) {
          addresses.push(this.deriveAddress(i, true));
        }
      }
    }
    return this.client.importAddresses({
      pubKey: this.authPubKey,
      payload: addresses.map(a => ({ address: a }))
    });
  }

  async getAddresses() {
    const walletAddresses = await this.client.getAddresses({
      pubKey: this.authPubKey
    });
    return walletAddresses.map(walletAddress => walletAddress.address);
  }

  async getLocalAddress(address) {
    return this.storage.getAddress({ name: this.name, address });
  }

  async getLocalAddresses(limit?: number, skip?: number) {
    return this.storage.getAddresses({ name: this.name, limit, skip });
  }

  async checkAddressOnServer(address) {
    const walletAddresses = await this.getAddresses();
    return !!walletAddresses.find(a => a === address);
  }

  deriveAddress(addressIndex, isChange) {
    if (addressIndex === 0 && this.addressZero) {
      return this.addressZero;
    }
    const address = Deriver.deriveAddress(this.chain, this.network, this.xPubKey, addressIndex, isChange, this.addressType);
    return address;
  }

  async solSignMessage(privateKey, message) {
    const privKeyBytes = SolKit.getBase58Encoder().encode(privateKey);
    const keypair = await SolKit.createKeyPairFromPrivateKeyBytes(privKeyBytes);
    const encodedMessage = SolKit.getUtf8Encoder().encode(message);
    const signedBytes = await SolKit.signBytes(keypair.privateKey, encodedMessage);
    return SolKit.getBase58Decoder().decode(signedBytes);
  }

  async getBlockTip() {
    return this.client.getBlockTip();
  }

  async derivePrivateKey(isChange, addressIndex = this.addressIndex) {
    const keyToImport = await Deriver.derivePrivateKey(
      this.chain,
      this.network,
      this.unlocked.masterKey,
      addressIndex || 0,
      isChange,
      this.addressType
    );
    return keyToImport;
  }

  async nextAddressPair(withChangeAddress?: boolean) {
    return this.generateAddressPair(this.addressIndex, withChangeAddress);
  }

  async generateAddressPair(addressIndex: number, withChangeAddress?: boolean) {
    if (this.lite) {
      return this.nextAddressPairLite(withChangeAddress);
    }
    addressIndex = addressIndex || 0;
    const newPrivateKey = await this.derivePrivateKey(false, addressIndex);
    const keys = [newPrivateKey];
    if (withChangeAddress) {
      const newChangePrivateKey = await this.derivePrivateKey(true, addressIndex);
      keys.push(newChangePrivateKey);
    }
    if (addressIndex === this.addressIndex) {
      this.addressIndex++;
    }
    await this.importKeys({ keys });
    if (addressIndex === 0) {
      this.addressZero = newPrivateKey.address.toString();
    }
    await this.saveWallet();
    return keys.map(key => key.address.toString());
  }

  async nextAddressPairLite(withChangeAddress?: boolean) {
    return this.generateAddressPairLite(this.addressIndex, withChangeAddress);
  }

  async generateAddressPairLite(addressIndex: number, withChangeAddress?: boolean) {
    addressIndex = addressIndex || 0;
    const addresses = [];
    addresses.push(this.deriveAddress(this.addressIndex, false));
    if (withChangeAddress) {
      addresses.push(this.deriveAddress(this.addressIndex, true));
    }
    if (addressIndex === this.addressIndex) {
      this.addressIndex++;
    }
    await this.client.importAddresses({
      pubKey: this.authPubKey,
      payload: addresses
    });
    await this.saveWallet();
    return addresses;
  }

  async getNonce(_addressIndex: number = 0, isChange?: boolean) {
    const address = this.deriveAddress(0, isChange);
    const count = await this.client.getNonce({ address });
    if (!count || typeof count.nonce !== 'number') {
      throw new Error('Unable to get nonce');
    }
    return count.nonce;
  }

  private async _getChangeAddress() {
    if (!this.isUtxoChain()) {
      return;
    }
    const key = await this.derivePrivateKey(true, this.addressIndex);
    await this.importKeys({ keys: [key] });
    return key.address;
  }

  async bumpTxFee({ txid, rawTx, changeIdx, feeRate, feeTarget, feePriority, noRbf, isSweep } = {} as BumpTxFeeType) {
    if (changeIdx == null && this.isUtxoChain()) {
      throw new Error('Must provide changeIdx for UTXO chains');
    }

    const lib = this.getLib();
    let existingTx;
    if (rawTx) {
      if (lib.ethers) {
        existingTx = lib.ethers.utils.parseTransaction(rawTx);
      } else {
        const tx = new lib.Transaction(rawTx);
        txid = tx.id;
      }
    }
    if (txid) {
      existingTx = await this.getTransactionByTxid({ txid, populated: this.isUtxoChain() });
    } else if (!existingTx) {
      throw new Error('Must provide either rawTx or txid');
    }

    const params: any = {};

    if (this.isUtxoChain()) {
      const { coins: { inputs, outputs }, locktime } = existingTx;

      params.utxos = inputs;
      params.change = outputs.find(o => o.mintIndex == changeIdx).address;
      params.recipients = outputs.filter(o => o.mintIndex != changeIdx).map(o => ({ address: o.address, amount: o.value }));
      params.lockUntilBlock = locktime > 0 ? locktime : undefined;
      params.replaceByFee = !noRbf;
      params.isSweep = isSweep ?? outputs.length === 1;
      if (feeRate) {
        params.feeRate = feeRate;
      } else {
        const scale = 1e5; // convert from sat/kb to sat/byte
        params.feeRate = Math.ceil((await this.getNetworkFee({ target: feeTarget })).feerate * scale);
        console.log(`Bumping fee rate to ${params.feeRate} sats/byte`);
      }

    // EVM chains
    } else {
      const { nonce, gasLimit, gasPrice, to, data, value, chainId, type } = existingTx;
      // converting gasLimit and value with toString avoids a bigNumber warning
      params.nonce = nonce;
      params.gasLimit = gasLimit?.toString();
      params.gasPrice = gasPrice;
      params.data = data;
      params.chainId = chainId;
      params.type = type;
      params.recipients = [{ address: to, amount: value.toString() }];
      
      // TODO fix type2 support
      // eslint-disable-next-line no-constant-condition, no-constant-binary-expression
      if (false && existingTx.type === 2) {
        if (feeRate) {
          params.maxGasFee = Web3.utils.toWei(feeRate.toString(), 'gwei');
        } else {
          // TODO placeholder until for type2 support is merged in another PR
          // params.maxGasFee = (await wallet.getNetworkFee({ target: feeTarget })).feerate;
          // console.log(`Bumping max gas price to ${Web3.utils.fromWei(params.maxGasFee.toString(), 'gwei')} gwei`);
        }
        if (feePriority) {    
          params.maxPriorityFee = Web3.utils.toWei(feePriority.toString(), 'gwei');
        } else {
          // TODO placeholder until for type2 support is merged in another PR
          // params.maxPriorityFee = existingTx.maxPriorityFeePerGas;
          // console.log(`Bumping max priority fee to ${Web3.utils.fromWei(params.maxPriorityFee.toString(), 'gwei')} gwei`);
        }

      // type 0
      } else {
        if (feeRate) {
          params.gasPrice = Web3.utils.toWei(feeRate.toString(), 'gwei');
        } else {
          params.gasPrice = (await this.getNetworkFee({ target: feeTarget })).feerate;
          console.log(`Bumping gas price to ${Web3.utils.fromWei(params.gasPrice.toString(), 'gwei')} gwei`);
        }
      }
      
    }

    const tx: string = await this.newTx(params);
    return { tx, params };
  }

  async getAccountFlags({ index }) {
    const account = this.deriveAddress(index ?? 0, false);
    return this.client.getAccountFlags({ address: account });
  }


  async estimateGas(params: { to: string; from: string; data: string; value: string }) {
    return this.client.estimateGas(params);
  }

  async getL1Fee(rawTx) {
    try {
      return this.client.getL1Fee({ rawTx });
    } catch {
      return 0;
    }
  }

  isMainnet() {
    return this.network === 'mainnet' || this.network === 'livenet';
  }

  isUnlocked() {
    return !!this.unlocked;
  }
}

export const AddressTypes = {
  BTC: {
    // pubkeyhash
    pubkeyhash: 'pubkeyhash',
    p2pkh: 'pubkeyhash',

    // scripthash
    scripthash: 'scripthash',
    p2sh: 'scripthash',

    // witnesspubkeyhash
    witnesspubkeyhash: 'witnesspubkeyhash',
    p2wpkh: 'witnesspubkeyhash',
    
    // taproot
    taproot: 'taproot',
    p2tr: 'taproot'
  },
  BCH: {
    // pubkeyhash
    pubkeyhash: 'pubkeyhash',
    p2pkh: 'pubkeyhash',

    // scripthash
    scripthash: 'scripthash',
    p2sh: 'scripthash'
  },
  LTC: {
    // pubkeyhash
    pubkeyhash: 'pubkeyhash',
    p2pkh: 'pubkeyhash',

    // scripthash
    scripthash: 'scripthash',
    p2sh: 'scripthash',

    // witnesspubkeyhash
    witnesspubkeyhash: 'witnesspubkeyhash',
    p2wpkh: 'witnesspubkeyhash',
  },
  DOGE: {
    // pubkeyhash
    pubkeyhash: 'pubkeyhash',
    p2pkh: 'pubkeyhash',

    // scripthash
    scripthash: 'scripthash',
    p2sh: 'scripthash'
  }
};