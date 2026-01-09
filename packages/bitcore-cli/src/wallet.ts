import fs from 'fs';
import path from 'path';
import url from 'url';
import * as prompt from '@clack/prompts';
import {
  API,
  Utils as BWCUtils,
  Credentials,
  Encryption,
  EncryptionTypes,
  Key,
  type Network,
  TssKey,
  Txp
} from 'bitcore-wallet-client';
import {
  BitcoreLib,
  type Types as CWCTypes,
  Utils as CWCUtils,
  Message,
  Transactions,
  Web3
} from 'crypto-wallet-core';
import { Constants } from './constants';
import { ERC20Abi } from './erc20Abi';
import { FileStorage } from './filestorage';
import { getPassword } from './prompts';
import { sign as tssSign } from './tss';
import { Utils } from './utils';
import type {
  ClientType,
  ITokenObj,
  IWallet,
  KeyType,
  TssKeyType,
  WalletData
} from '../types/wallet';

const Client = API;

const WALLET_ENCRYPTION_OPTS = {
  iter: 5000
};

process.on('uncaughtException', (uncaught) => {
  Utils.die(uncaught);
});

let _verbose = false;

export class Wallet implements IWallet {
  static _bpCurrencies: ITokenObj[];

  name: string;
  dir: string;
  filename: string;
  storage: FileStorage;
  host: string;
  walletId: string; // For support staff wallets to query other wallets
  #walletData: WalletData;
  client: ClientType;
  isFullyEncrypted?: boolean; // All wallet data is encrypted, not just the mnemonic/private key(s)

  get chain() {
    return this.client?.credentials?.chain;
  }

  get network() {
    return this.client?.credentials?.network as Network;
  }

  constructor(args: {
    name: string;
    dir: string;
    verbose?: boolean;
    host?: string;
    walletId?: string;
  }) {
    const { name, dir, verbose, host, walletId } = args || {};
    this.name = name;
    this.dir = dir;
    this.filename = Utils.getWalletFileName(name, dir);
    this.storage = new FileStorage({ filename: this.filename });
    this.host = host || 'https://bws.bitpay.com/';
    this.walletId = walletId;
    Wallet.setVerbose(verbose);
  }

  static setVerbose(v: boolean) {
    _verbose = !!v;
    Utils.setVerbose(v);
  }

  async getClient(args: {
    mustBeNew?: boolean;
    mustExist?: boolean;
    doNotComplete?: boolean;
  }): Promise<ClientType> {
    const { mustBeNew, mustExist, doNotComplete } = args;

    this.client = new Client({
      baseUrl: url.resolve(this.host, '/bws/api'),
      supportStaffWalletId: this.walletId
    });

    const exists = this.storage.exists();
    if (exists && mustBeNew) {
      Utils.die(`File "${this.filename}" already exists.`);
    }
    if (!exists) {
      if (mustExist) {
        Utils.die(`File "${this.filename}" not found.`);
      }
      return this.client;
    }

    _verbose && prompt.intro('Loading wallet');
    const key = await this.load({ doNotComplete, allowCache: true });
    _verbose && prompt.outro(`${!key ? 'Read-only ' : ''}Wallet loaded`);

    return this.client;
  }

  async create(args: {
    coin?: string;
    chain: string;
    network: Network;
    copayerName: string;
    account: number;
    n: number;
    m?: number;
    mnemonic?: string;
    password?: string;
    addressType?: string;
  }) {
    const { coin, chain, network, account, n, m, mnemonic, password, addressType, copayerName } = args;
    let key: KeyType;
    if (mnemonic) {
      key = new Key({ seedType: 'mnemonic', seedData: mnemonic, password });
    } else {
      key = new Key({ seedType: 'new', password });
    }
    const credOpts = { coin, chain, network, account, n, m, mnemonic, password, addressType, copayerName, singleAddress: BWCUtils.isSingleAddressChain(chain) };
    const credentials = key.createCredentials(password, credOpts);
    this.client.fromObj(credentials);
    this.#walletData = { key, credentials };
    await this.save();
    const secret = await this.register({ copayerName });
    await this.load();
    return { key, credentials, secret };
  }

  async createFromTss(args: {
    key: TssKeyType;
    chain: string;
    network: Network;
    password: string;
    addressType?: string;
    copayerName: string;
  }) {
    const { key, chain, network, addressType, password } = args;
    if (!this.client) {
      await this.getClient({ mustExist: true });
    }
    const credentials = key.createCredentials(password, {
      chain,
      network,
      account: 0,
      addressType
    });
    this.client.fromObj(credentials.toObj());
    this.#walletData = { key, credentials: this.client.credentials };
    await this.save();
    // await this.register({ copayerName });
    await this.load();
    return { key, credentials: this.client.toObj() };
  }

  async register(args: { copayerName: string }) {
    if (!this.client) {
      await this.getClient({ mustExist: true });
    }
    const { chain, coin, network, m, n, addressType } = this.client.credentials;
    if (coin && coin !== chain) {
      // temporarily set it to chain for registration.
      // coin != chain for token wallets exported from the app.
      this.client.credentials.coin = chain;
    }
    const { secret } = await this.client.createWallet(
      this.name,
      args.copayerName,
      m,
      n,
      {
        chain,
        network: network as Network,
        ...Utils.getSegwitInfo(addressType)
      }
    );
    if (coin) {
      this.client.credentials.coin = coin; // change it back.
    }
    return secret as string | undefined;
  }

  async load(opts?: { doNotComplete?: boolean; allowCache?: boolean }) {
    const { doNotComplete, allowCache } = opts || {};

    let walletData: WalletData | EncryptionTypes.IEncrypted = allowCache ? this.#walletData : null;
    if (!walletData) {
      walletData = await this.storage.load();
    }
    if ((walletData as EncryptionTypes.IEncrypted).ct) {
      const password = await getPassword('Wallet decryption password:', { hidden: true });
      try {
        walletData = JSON.parse(Encryption.decryptWithPassword(walletData as EncryptionTypes.IEncrypted, password).toString());
        this.isFullyEncrypted = true;
      } catch {
        Utils.die('Could not open wallet. Wrong password.');
      }
    }
    walletData = (walletData as WalletData);
    

    const instantiateKey = () => {
      if (!walletData.key) {
        return undefined; // read-only wallet
      }
      const obj = walletData.key.toObj ? walletData.key.toObj() : walletData.key;
      if ((obj as TssKeyType).metadata) {
        return new TssKey.TssKey(obj as TssKeyType);
      } else {
        obj.version = obj.version ?? 1;
        return new Key({ seedType: 'object', seedData: obj });
      }
    };

    let key: KeyType;
    try {
      const imported = Client.upgradeCredentialsV1(walletData);
      this.client.fromString(JSON.stringify(imported.credentials));

      key = instantiateKey();
    } catch {
      try {
        this.client.fromObj(walletData.credentials);
        key = instantiateKey();
      } catch (e) {
        Utils.die('Corrupt wallet file:' + (_verbose && e.stack ? e.stack : e));
      }
    }

    this.#walletData = {
      key,
      credentials: Credentials.fromObj(walletData.credentials)
    } as WalletData;

    if (doNotComplete) return key;


    this.client.on('walletCompleted', (_wallet) => {
      this.save().then(() => {
        _verbose && prompt.log.info('Your wallet has just been completed.');
      });
    });
    await this.client.openWallet();
    return key;
  };

  async save(opts?: { encryptAll?: boolean }) {
    const { encryptAll } = opts || {};
    try {
      if (!this.#walletData) {
        throw new Error('No wallet data to save. Wallet not created or loaded');
      }
      let data: WalletData | EncryptionTypes.IEncrypted = { key: this.#walletData.key.toObj(), credentials: this.#walletData.credentials.toObj() };
      if (encryptAll) {
        const password = await getPassword('Enter password to encrypt:', { minLength: 6 });
        await prompt.password({
          message: 'Confirm password:',
          mask: '*',
          validate: (val) => val === password ? undefined : 'Passwords do not match'
        });

        data = Encryption.encryptWithPassword(JSON.stringify(data), password, WALLET_ENCRYPTION_OPTS);
      }
      await this.storage.save(JSON.stringify(data));
      return;
    } catch (err) {
      Utils.die(err);
    }
  }

  async export(args: {
    filename: string;
    exportPassword?: string;
  }) {
    const { filename, exportPassword } = args;
    if (!this.#walletData) {
      throw new Error('No wallet data to save. Wallet not created or loaded');
    }
    
    let key;
    if (this.#walletData.key instanceof TssKey.TssKey) {
      key = new TssKey.TssKey(this.#walletData.key.toObj());
    } else {
      key = new Key({ seedType: 'object', seedData: this.#walletData.key.toObj() });
    }
    if (key.isPrivKeyEncrypted() || key.isKeyChainEncrypted?.()) {
      const walletPassword = await getPassword('Wallet password:');
      key.decrypt(walletPassword);
    }
    
    let data: any = { key: key.toObj(), credentials: this.#walletData.credentials.toObj() };
    if (exportPassword != null) {
      data = Encryption.encryptWithPassword(data, exportPassword, WALLET_ENCRYPTION_OPTS);
    }

    const pathname = path.dirname(filename);
    if (!fs.existsSync(pathname)) {
      fs.mkdirSync(pathname, { recursive: true });
    }
    return fs.promises.writeFile(filename, JSON.stringify(data));
  }

  async import(args: {
    filename: string;
    importPassword?: string;
  }) {
    const { filename, importPassword } = args;
    let data: any = await fs.promises.readFile(filename, 'utf8');
    data = Encryption.decryptWithPassword(data, importPassword);
    data = Utils.jsonParseWithBuffer(data);
    if (data.key.keychain) {
      data.key = new TssKey.TssKey(data.key);
    } else {
      data.key = new Key({ seedType: 'object', seedData: data.key });
    }
    const walletPassword = await getPassword('Wallet password:', { minLength: 6, hidden: false });
    data.key.encrypt(walletPassword);
    this.#walletData = {
      key: data.key,
      credentials: Credentials.fromObj(data.credentials)
    };
    await this.save();
  }

  isComplete() {
    if (!this.client) {
      Utils.die('Wallet client not initialized. Call getClient() first.');
    }
    if (!this.client.credentials) {
      Utils.die('Wallet credentials not initialized. Call load() first.');
    }
    return this.client.credentials.isComplete();
  }

  static async getCurrencies(network: Network) {
    if (!Wallet._bpCurrencies) {
      const urls = {
        livenet: process.env['BITCORE_CLI_CURRENCIES_URL'] || 'https://bitpay.com/currencies',
        testnet: process.env['BITCORE_CLI_CURRENCIES_URL'] || 'https://test.bitpay.com/currencies',
        regtest: process.env['BITCORE_CLI_CURRENCIES_URL_REGTEST']
      };
      let response: Response;
      try {
        response = await fetch(urls[network], { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        if (!response.ok) {
          throw new Error(`Failed to fetch currencies for wallet token check: ${response.statusText}`);
        }
      } catch (err) {
        throw new Error(`Unable to fetch currencies from ${urls[network]}. ${err}`);
      }
      const { data: bpCurrencies } = await response.json();
      Wallet._bpCurrencies = bpCurrencies.map(c => ({
        toSatoshis: Math.pow(10, c.decimals),
        ...c,
        decimals: {
          full: {
            maxDecimals: c.decimals,
            minDecimals: c.decimals,
          },
          short: {
            maxDecimals: c.decimals,
            minDecimals: c.precision
          }
        },
      }));
    }
    return Wallet._bpCurrencies;
  };

  async getToken(args: { token?: string; tokenAddress?: string }) {
    const { token, tokenAddress } = args;
    if (tokenAddress) {
      let tokenObj = await this.getTokenByAddress({ tokenAddress });
      if (!tokenObj) {
        tokenObj = await this.getTokenFromChain({ address: tokenAddress });
      }
      return tokenObj;
    } else if (token) {
      return this.getTokenByName({ token });
    }
    return null;
  }
  
  async getTokenByAddress(args: { tokenAddress: string }) {
    const { tokenAddress } = args;
    const currencies = await Wallet.getCurrencies(this.network);
    return currencies.find(currency => currency.contractAddress?.toLowerCase() === tokenAddress?.toLowerCase());
  }

  async getTokenByName(args: { token: string }) {
    const { token } = args;
    const chain = this.chain.toUpperCase();
    const currencies = await Wallet.getCurrencies(this.network);
    return currencies.find(c => c.chain === chain && (c.code === token || c.displayCode === token));
  }

  async getTokenFromChain(args: { address: string }) {
    const { address } = args;
    const chain = this.chain.toUpperCase();
    const network = this.network === 'livenet' ? 'mainnet' : this.network;
    const web3 = new Web3(Constants.PUBLIC_API[chain][network]);
    const contract = new web3.eth.Contract(ERC20Abi as any, address);
    const token = await contract.methods.symbol().call<string>();
    const decimals = Number(await contract.methods.decimals().call<bigint>());
    return {
      code: token,
      displayCode: token,
      decimals: {
        full: { maxDecimals: decimals, minDecimals: decimals },
        short: { maxDecimals: Math.min(decimals, 4), minDecimals: Math.min(decimals, 4) }
      },
      precision: decimals,
      toSatoshis: Math.pow(10, decimals),
      contractAddress: address,
      chain: chain.toUpperCase(),
    } as ITokenObj;
  }

  async getNativeCurrency(fallback?: boolean): Promise<ITokenObj | null> {
    const chain = this.chain.toUpperCase();
    let retval = null;
    try {
      const currencies = await Wallet.getCurrencies(this.network);
      retval = currencies.find(c => c.chain === chain && c.native);
    } catch (err) {
      prompt.log.warn(`Unable to fetch native currency for ${chain}: ${err}`);
    }
    if (fallback && !retval) {
      retval = { displayCode: chain };
    }
    return retval;
  }

  async getPasswordWithRetry(): Promise<string> {
    let password;
    if (this.isWalletEncrypted()) {
      password = await getPassword('Wallet password:', {
        hidden: true,
        validate: (input) => {
          try {
            this.#walletData.key.get(input);
          } catch {
            return 'Invalid password. Please try again.';
          }
        }
      });
    }
    return password;
  }

  async signTxp(args: {
    txp: Txp;
  }): Promise<string[]> {
    const { txp } = args;
    if (!this.client) {
      await this.getClient({ mustExist: true });
    }

    const password = await this.getPasswordWithRetry();
    if (this.#walletData.key instanceof TssKey.TssKey) {
      return this._signTxpTss({ txp, password });
    }

    const rootPath = this.client.getRootPath();
    const sigs = await this.#walletData.key.sign(rootPath, txp, password);
    return sigs;
  }

  async _signTxpTss(args: {
    txp: Txp;
    password: string;
  }): Promise<string[]> {
    const { txp, password } = args;

    const isUtxo = BWCUtils.isUtxoChain(txp.chain);
    const isSvm = BWCUtils.isSvmChain(txp.chain);

    if (isSvm) {
      throw new Error('TSS wallets do not yet support Solana.');
    }

    const sigs: string[] = [];

    const inputPaths = !isUtxo && !txp.inputPaths?.length ? ['m/0/0'] : txp.inputPaths;
    const tx = BWCUtils.buildTx(txp);
    const xPubKey = new BitcoreLib.HDPublicKey(this.#walletData.credentials.clientDerivedPublicKey);

    for (let i = 0; i < inputPaths.length; i++) {
      const derivationPath = inputPaths[i];
      const pubKey = xPubKey.deriveChild(derivationPath).publicKey.toString();
      const txHex = tx.uncheckedSerialize();

      const messageHash = Transactions.getSighash({
        chain: this.chain,
        network: this.network,
        tx: Array.isArray(txHex) ? txHex[0] : txHex,
        index: i,
        utxos: txp.inputs,
        pubKey
      });

      const signature = await tssSign({
        host: this.host,
        chain: txp.chain,
        walletData: this.#walletData,
        messageHash: Buffer.from(messageHash, 'hex'),
        derivationPath,
        password,
        id: `${txp.id}:${derivationPath.replace(/\//g, '-')}`,
        logMessageWaiting: `Signing tx input ${i} (${i + 1}/${inputPaths.length}). Waiting for all parties to join...`,
        logMessageCompleted: `Tx input ${i} complete (${i + 1}/${inputPaths.length})`
      });

      sigs.push(signature.signature as string);
    }

    prompt.log.success('TSS signature(s) generated successfully!');
    return sigs;
  }

  async signAndBroadcastTxp(args: {
    txp: Txp;
  }) {
    const { txp } = args;

    const signatures = await this.signTxp({ txp });
    try {
      const signedTxp = await this.client.pushSignatures(txp, signatures);
      if (signedTxp.actions.filter(a => a.type === 'accept').length < signedTxp.requiredSignatures) {
        _verbose && prompt.log.info(`Tx proposal ${signedTxp.id} is not ready to broadcast. Waiting for more signatures.`);
        return signedTxp;
      }

      const { txp: broadcastedTxp } = await this.client.broadcastTxProposal(signedTxp);
      return broadcastedTxp;
    } catch (err) {
      // already broadcasted by another copayer?
      const refreshedTxp = await this.client.getTx(txp.id);
      if (refreshedTxp.status !== 'broadcasted') {
        throw err;
      }
      return refreshedTxp;
    }
  }

  async signMessage(args: {
    message: string;
    derivationPath: string;
    encoding?: BufferEncoding | 'base58';
  }): Promise<CWCTypes.Message.ISignedMessage> {
    const { message, derivationPath, encoding } = args;

    if (!this.client) {
      await this.getClient({ mustExist: true });
    }
    const password = await this.getPasswordWithRetry();
    const chain = this.client.credentials.chain;

    if (this.#walletData.key instanceof TssKey.TssKey) {
      const messageHash = Message.getMessageHash({ chain, message }) as Buffer;
      return this._signMessageWithTss({ messageHash, derivationPath, password, encoding });
    }

    const hdPrivateKey = this.#walletData.key.get(password).xPrivKey;
    const fullDerivationPath = this.client.getRootPath() + derivationPath.replace('m', '');
    return Message.signMessageWithPath({ chain, message, derivationPath: fullDerivationPath, hdPrivateKey, encoding });
  }

  async _signMessageWithTss(args: {
    messageHash: Buffer;
    derivationPath?: string;
    password?: string;
    encoding?: BufferEncoding | 'base58';
  }): Promise<CWCTypes.Message.ISignedMessage> {
    const { messageHash, derivationPath, password, encoding } = args;

    if (!this.isTss()) {
      throw new Error('TSS signing is only supported for TSS wallets.');
    }

    const sig = await tssSign({
      host: this.host,
      chain: this.client.credentials.chain,
      walletData: this.#walletData,
      messageHash,
      derivationPath,
      password
    });

    const buf = Buffer.from(sig.signature.replace('0x', ''), 'hex');
    return {
      signature: CWCUtils.encodeBuffer(buf, encoding),
      publicKey: sig.publicKey
    };
  }

  async getXPrivKey(password?: string): Promise<string> {
    password = password || await getPassword();
    return this.#walletData.key.get(password).xPrivKey;
  }

  getXPubKey() {
    return this.client.credentials.clientDerivedPublicKey || this.client.credentials.xPubKey;
  }

  isMultiSig() {
    return this.client.credentials.n > 1;
  }

  isTss() {
    return this.#walletData.key instanceof TssKey.TssKey;
  }

  getMinSigners() {
    return (this.#walletData.key as TssKey.TssKey).metadata?.m || this.client.credentials.m || 1;
  }

  isWalletEncrypted() {
    return this.#walletData.key.isPrivKeyEncrypted() || (this.#walletData.key as TssKey.TssKey).isKeyChainEncrypted?.();
  }

  isUtxo() {
    return BWCUtils.isUtxoChain(this.chain);
  }

  isEvm() {
    return BWCUtils.isEvmChain(this.chain);
  }

  isSvm() {
    return BWCUtils.isSvmChain(this.chain);
  }

  isXrp() {
    return BWCUtils.isXrpChain(this.chain);
  }

  isTokenChain() {
    return this.isEvm() || this.isSvm();
  }

  isReadOnly() {
    return !this.#walletData.key;
  }
};