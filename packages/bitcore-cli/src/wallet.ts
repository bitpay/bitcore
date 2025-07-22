import * as prompt from '@clack/prompts';
import {
  API,
  Credentials,
  Encryption,
  EncryptionTypes,
  Key,
  Network,
  TssKey,
  TssSign,
  Txp,
  Utils as BWCUtils
} from 'bitcore-wallet-client';
import { ethers, Web3 } from 'crypto-wallet-core';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { Constants } from './constants';
import { ERC20Abi } from './erc20Abi';
import { UserCancelled } from './errors';
import { FileStorage } from './filestorage';
import { getPassword } from './prompts';
import { Utils } from './utils';

const Client = API;

export type KeyType = Key;
export type ClientType = API;
export type TssKeyType = TssKey.TssKey;
export type TssSigType = TssSign.ISignature;

export interface WalletData {
  key: KeyType | TssKeyType;
  creds: Credentials;
}

const WALLET_ENCRYPTION_OPTS = {
  iter: 5000
};

process.on('uncaughtException', (uncaught) => {
  Utils.die(uncaught);
});

let _verbose = false;

export class Wallet {
  static _bpCurrencies;

  name: string;
  dir: string;
  filename: string;
  storage: FileStorage;
  host: string;
  walletId: string; // For support staff wallets to query other wallets
  #walletData: WalletData;
  client: ClientType;
  isFullyEncrypted?: boolean; // All wallet data is encrypted, not just the mnemonic/private key(s)
  

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
    doNotComplete?: boolean
  }): Promise<ClientType> {
    const { mustBeNew, mustExist, doNotComplete } = args;

    this.client = new Client({
      baseUrl: url.resolve(this.host, '/bws/api'),
      supportStaffWalletId: this.walletId
    });

    try {
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
      await this.load({ doNotComplete, allowCache: true });
      _verbose && prompt.outro('Wallet loaded');
    } catch (err) {
      Utils.die(err);
    }
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
    const credOpts = { coin, chain, network, account, n, m, mnemonic, password, addressType, singleAddress: BWCUtils.isSingleAddressChain(chain) };
    const creds = key.createCredentials(password, credOpts);
    this.client.fromObj(creds);
    this.#walletData = { key, creds };
    await this.save();
    const secret = await this.register({ copayerName });
    await this.load();
    return { key, creds, secret };
  }

  async createFromTss(args: {
    key: TssKeyType;
    chain: string;
    network: Network;
    password: string;
    addressType?: string;
    copayerName: string;
  }) {
    const { key, chain, network, addressType, password, copayerName } = args;
    if (!this.client) {
      await this.getClient({ mustExist: true });
    }
    const creds = key.createCredentials(password, {
      chain,
      network,
      account: 0,
      addressType
    });
    this.client.fromObj(creds.toObj());
    this.#walletData = { key, creds: this.client.credentials };
    await this.save();
    // await this.register({ copayerName });
    await this.load();
    return { key, creds: this.client.toObj() };
  }

  async register(args: { copayerName: string; }) {
    if (!this.client) {
      await this.getClient({ mustExist: true });
    }
    const { chain, network, m, n, addressType } = this.client.credentials;
    const { wallet, secret } = await this.client.createWallet(this.name, args.copayerName, m, n, { chain, network: network as Network, ...Utils.getSegwitInfo(addressType) });
    return secret as string | undefined;
  }

  async load(opts?: { doNotComplete?: boolean; allowCache?: boolean; }) {
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
      } catch (e) {
        Utils.die('Could not open wallet. Wrong password.');
      }
    }
    walletData = (walletData as WalletData);
    

    const instantiateKey = () => {
      const obj = walletData.key.toObj ? walletData.key.toObj() : walletData.key;
      if ((obj as TssKeyType).metadata) {
        return new TssKey.TssKey(obj as TssKeyType);
      } else {
        return new Key({ seedType: 'object', seedData: obj });
      }
    };

    let key: KeyType;
    try {
      let imported = Client.upgradeCredentialsV1(walletData);
      this.client.fromString(JSON.stringify(imported.credentials));

      key = instantiateKey();
    } catch (e) {
      try {
        this.client.fromObj(walletData.creds);
        key = instantiateKey();
      } catch (e) {
        Utils.die('Corrupt wallet file:' + (_verbose && e.stack ? e.stack : e));
      }
    }

    this.#walletData = {
      key,
      creds: Credentials.fromObj(walletData.creds)
    } as WalletData;

    if (doNotComplete) return key;


    this.client.on('walletCompleted', (wallet) => {
      this.save().then(() => {
        _verbose && prompt.log.info('Your wallet has just been completed.');
      });
    });
    const isComplete = await this.client.openWallet();
    return key;
  };

  async save(opts?: { encryptAll?: boolean; }) {
    const { encryptAll } = opts || {};
    try {
      if (!this.#walletData) {
        throw new Error('No wallet data to save. Wallet not created or loaded');
      }
      let data: WalletData | EncryptionTypes.IEncrypted = { key: this.#walletData.key.toObj(), creds: this.#walletData.creds.toObj() };
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
    
    let data: any = { key: key.toObj(), creds: this.#walletData.creds.toObj() };
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
      creds: Credentials.fromObj(data.creds)
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

  static async getCurrencies(network: Network = 'livenet') {
    if (!Wallet._bpCurrencies) {
      const urls = {
        livenet: process.env['BITCORE_CLI_CURRENCIES_URL'] || 'https://bitpay.com/currencies',
        testnet: process.env['BITCORE_CLI_CURRENCIES_URL'] || 'https://test.bitpay.com/currencies',
        regtest: process.env['BITCORE_CLI_CURRENCIES_URL_REGTEST']
      };
      const response = await fetch(urls[network], { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) {
        throw new Error(`Failed to fetch currencies for wallet token check: ${response.statusText}`);
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

  async getTokenByAddress(tokenAddress) {
    const currencies = await Wallet.getCurrencies();
    return currencies.find(currency => currency.contractAddress?.toLowerCase() === tokenAddress?.toLowerCase());
  }

  async getToken(chain, token) {
    chain = chain.toUpperCase();
    const currencies = await Wallet.getCurrencies();
    return currencies.find(c => c.chain === chain && (c.code === token || c.displayCode === token));
  }

  async getTokenFromChain(chain, network, address) {
    network = network === 'livenet' ? 'mainnet' : network;
    const web3 = new Web3(Constants.PUBLIC_API[chain][network]);
    const contract = new web3.eth.Contract(ERC20Abi as any, address);
    const token = await contract.methods.symbol().call();
    const decimals = Number(await contract.methods.decimals().call());
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
      chain: chain.toUpperCase()
    };
  }

  async signTxp(args: {
    txp: Txp;
  }): Promise<string[]> {
    const { txp } = args;
    if (!this.client) {
      await this.getClient({ mustExist: true });
    }

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

    const transformISignature = (signature: TssSign.ISignature): string => {
      if ('ETH' === 'ETH') { // TODO - always ETH
        return ethers.Signature.from(signature).serialized;
      }
    };

    const tssSign = new TssSign.TssSign({
      baseUrl: url.resolve(this.host, '/bws/api'),
      credentials: this.#walletData.creds,
      tssKey: this.#walletData.key as TssKeyType
    });

    try {
      // TODO: make this work for non-EVM
      const messageHash = ethers.keccak256(Client.getRawTx(txp)[0]).slice(2); // remove 0x prefix
      await tssSign.start({
        id: txp.id,
        messageHash: Buffer.from(messageHash, 'hex'),
        encoding: 'hex',
        derivationPath: 'm/0/0', // TODO - consider UTXO chains
        password
      });
    } catch (err) {
      if (err.message?.startsWith('TSS_ROUND_ALREADY_DONE')) {
        const sig = await tssSign.getSignatureFromServer();
        if (!sig) {
          throw new Error('It looks like the TSS signature session was interrupted. Try deleting this proposal and creating a new one.');
        }
        return [transformISignature(sig)];
      }
      throw err;
    }
    const spinner = prompt.spinner({ indicator: 'timer' });
    spinner.start('Waiting for all parties to join...');
    
    const sig = await new Promise<string>((resolve, reject) => {
      process.on('SIGINT', () => {
        tssSign.unsubscribe();
        spinner.stop('Cancelled by user');
        reject(new UserCancelled());
      });

      tssSign.subscribe();
      tssSign.on('roundsubmitted', (round) => spinner.message(`Round ${round} submitted`));
      tssSign.on('error', prompt.log.error);
      tssSign.on('complete', async () => {
        try {
          spinner.stop('TSS Signature Generation Complete!');
          const signature: TssSign.ISignature = tssSign.getSignature();
          let sigString: string;
          if (true) { // ETH
            sigString = transformISignature(signature);
          }
          resolve(sigString);
        } catch (err) {
          reject(err);
        }
      });
    });

    return [sig];
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

  async getXPrivKey(password?: string): Promise<string> {
    password = password || await getPassword();
    return this.#walletData.key.get(password).xPrivKey;
  }

  getXPubKey() {
    return this.client.credentials.clientDerivedPublicKey || this.client.credentials.xPubKey;
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
};