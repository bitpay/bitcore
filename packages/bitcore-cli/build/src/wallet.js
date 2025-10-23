"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _Wallet_walletData;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wallet = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const url_1 = __importDefault(require("url"));
const prompt = __importStar(require("@clack/prompts"));
const bitcore_wallet_client_1 = require("bitcore-wallet-client");
const crypto_wallet_core_1 = require("crypto-wallet-core");
const constants_1 = require("./constants");
const erc20Abi_1 = require("./erc20Abi");
const filestorage_1 = require("./filestorage");
const prompts_1 = require("./prompts");
const tss_1 = require("./tss");
const utils_1 = require("./utils");
const Client = bitcore_wallet_client_1.API;
const WALLET_ENCRYPTION_OPTS = {
    iter: 5000
};
process.on('uncaughtException', (uncaught) => {
    utils_1.Utils.die(uncaught);
});
let _verbose = false;
class Wallet {
    get chain() {
        return this.client?.credentials?.chain;
    }
    get network() {
        return this.client?.credentials?.network;
    }
    constructor(args) {
        _Wallet_walletData.set(this, void 0);
        const { name, dir, verbose, host, walletId } = args || {};
        this.name = name;
        this.dir = dir;
        this.filename = utils_1.Utils.getWalletFileName(name, dir);
        this.storage = new filestorage_1.FileStorage({ filename: this.filename });
        this.host = host || 'https://bws.bitpay.com/';
        this.walletId = walletId;
        Wallet.setVerbose(verbose);
    }
    static setVerbose(v) {
        _verbose = !!v;
        utils_1.Utils.setVerbose(v);
    }
    async getClient(args) {
        const { mustBeNew, mustExist, doNotComplete } = args;
        this.client = new Client({
            baseUrl: url_1.default.resolve(this.host, '/bws/api'),
            supportStaffWalletId: this.walletId
        });
        const exists = this.storage.exists();
        if (exists && mustBeNew) {
            utils_1.Utils.die(`File "${this.filename}" already exists.`);
        }
        if (!exists) {
            if (mustExist) {
                utils_1.Utils.die(`File "${this.filename}" not found.`);
            }
            return this.client;
        }
        _verbose && prompt.intro('Loading wallet');
        await this.load({ doNotComplete, allowCache: true });
        _verbose && prompt.outro('Wallet loaded');
        return this.client;
    }
    async create(args) {
        const { coin, chain, network, account, n, m, mnemonic, password, addressType, copayerName } = args;
        let key;
        if (mnemonic) {
            key = new bitcore_wallet_client_1.Key({ seedType: 'mnemonic', seedData: mnemonic, password });
        }
        else {
            key = new bitcore_wallet_client_1.Key({ seedType: 'new', password });
        }
        const credOpts = { coin, chain, network, account, n, m, mnemonic, password, addressType, singleAddress: bitcore_wallet_client_1.Utils.isSingleAddressChain(chain) };
        const creds = key.createCredentials(password, credOpts);
        this.client.fromObj(creds);
        __classPrivateFieldSet(this, _Wallet_walletData, { key, creds }, "f");
        await this.save();
        const secret = await this.register({ copayerName });
        await this.load();
        return { key, creds, secret };
    }
    async createFromTss(args) {
        const { key, chain, network, addressType, password } = args;
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
        __classPrivateFieldSet(this, _Wallet_walletData, { key, creds: this.client.credentials }, "f");
        await this.save();
        await this.load();
        return { key, creds: this.client.toObj() };
    }
    async register(args) {
        if (!this.client) {
            await this.getClient({ mustExist: true });
        }
        const { chain, network, m, n, addressType } = this.client.credentials;
        const { secret } = await this.client.createWallet(this.name, args.copayerName, m, n, { chain, network: network, ...utils_1.Utils.getSegwitInfo(addressType) });
        return secret;
    }
    async load(opts) {
        const { doNotComplete, allowCache } = opts || {};
        let walletData = allowCache ? __classPrivateFieldGet(this, _Wallet_walletData, "f") : null;
        if (!walletData) {
            walletData = await this.storage.load();
        }
        if (walletData.ct) {
            const password = await (0, prompts_1.getPassword)('Wallet decryption password:', { hidden: true });
            try {
                walletData = JSON.parse(bitcore_wallet_client_1.Encryption.decryptWithPassword(walletData, password).toString());
                this.isFullyEncrypted = true;
            }
            catch {
                utils_1.Utils.die('Could not open wallet. Wrong password.');
            }
        }
        walletData = walletData;
        const instantiateKey = () => {
            const obj = walletData.key.toObj ? walletData.key.toObj() : walletData.key;
            if (obj.metadata) {
                return new bitcore_wallet_client_1.TssKey.TssKey(obj);
            }
            else {
                return new bitcore_wallet_client_1.Key({ seedType: 'object', seedData: obj });
            }
        };
        let key;
        try {
            const imported = Client.upgradeCredentialsV1(walletData);
            this.client.fromString(JSON.stringify(imported.credentials));
            key = instantiateKey();
        }
        catch {
            try {
                this.client.fromObj(walletData.creds);
                key = instantiateKey();
            }
            catch (e) {
                utils_1.Utils.die('Corrupt wallet file:' + (_verbose && e.stack ? e.stack : e));
            }
        }
        __classPrivateFieldSet(this, _Wallet_walletData, {
            key,
            creds: bitcore_wallet_client_1.Credentials.fromObj(walletData.creds)
        }, "f");
        if (doNotComplete)
            return key;
        this.client.on('walletCompleted', (_wallet) => {
            this.save().then(() => {
                _verbose && prompt.log.info('Your wallet has just been completed.');
            });
        });
        await this.client.openWallet();
        return key;
    }
    ;
    async save(opts) {
        const { encryptAll } = opts || {};
        try {
            if (!__classPrivateFieldGet(this, _Wallet_walletData, "f")) {
                throw new Error('No wallet data to save. Wallet not created or loaded');
            }
            let data = { key: __classPrivateFieldGet(this, _Wallet_walletData, "f").key.toObj(), creds: __classPrivateFieldGet(this, _Wallet_walletData, "f").creds.toObj() };
            if (encryptAll) {
                const password = await (0, prompts_1.getPassword)('Enter password to encrypt:', { minLength: 6 });
                await prompt.password({
                    message: 'Confirm password:',
                    mask: '*',
                    validate: (val) => val === password ? undefined : 'Passwords do not match'
                });
                data = bitcore_wallet_client_1.Encryption.encryptWithPassword(JSON.stringify(data), password, WALLET_ENCRYPTION_OPTS);
            }
            await this.storage.save(JSON.stringify(data));
            return;
        }
        catch (err) {
            utils_1.Utils.die(err);
        }
    }
    async export(args) {
        const { filename, exportPassword } = args;
        if (!__classPrivateFieldGet(this, _Wallet_walletData, "f")) {
            throw new Error('No wallet data to save. Wallet not created or loaded');
        }
        let key;
        if (__classPrivateFieldGet(this, _Wallet_walletData, "f").key instanceof bitcore_wallet_client_1.TssKey.TssKey) {
            key = new bitcore_wallet_client_1.TssKey.TssKey(__classPrivateFieldGet(this, _Wallet_walletData, "f").key.toObj());
        }
        else {
            key = new bitcore_wallet_client_1.Key({ seedType: 'object', seedData: __classPrivateFieldGet(this, _Wallet_walletData, "f").key.toObj() });
        }
        if (key.isPrivKeyEncrypted() || key.isKeyChainEncrypted?.()) {
            const walletPassword = await (0, prompts_1.getPassword)('Wallet password:');
            key.decrypt(walletPassword);
        }
        let data = { key: key.toObj(), creds: __classPrivateFieldGet(this, _Wallet_walletData, "f").creds.toObj() };
        if (exportPassword != null) {
            data = bitcore_wallet_client_1.Encryption.encryptWithPassword(data, exportPassword, WALLET_ENCRYPTION_OPTS);
        }
        const pathname = path_1.default.dirname(filename);
        if (!fs_1.default.existsSync(pathname)) {
            fs_1.default.mkdirSync(pathname, { recursive: true });
        }
        return fs_1.default.promises.writeFile(filename, JSON.stringify(data));
    }
    async import(args) {
        const { filename, importPassword } = args;
        let data = await fs_1.default.promises.readFile(filename, 'utf8');
        data = bitcore_wallet_client_1.Encryption.decryptWithPassword(data, importPassword);
        data = utils_1.Utils.jsonParseWithBuffer(data);
        if (data.key.keychain) {
            data.key = new bitcore_wallet_client_1.TssKey.TssKey(data.key);
        }
        else {
            data.key = new bitcore_wallet_client_1.Key({ seedType: 'object', seedData: data.key });
        }
        const walletPassword = await (0, prompts_1.getPassword)('Wallet password:', { minLength: 6, hidden: false });
        data.key.encrypt(walletPassword);
        __classPrivateFieldSet(this, _Wallet_walletData, {
            key: data.key,
            creds: bitcore_wallet_client_1.Credentials.fromObj(data.creds)
        }, "f");
        await this.save();
    }
    isComplete() {
        if (!this.client) {
            utils_1.Utils.die('Wallet client not initialized. Call getClient() first.');
        }
        if (!this.client.credentials) {
            utils_1.Utils.die('Wallet credentials not initialized. Call load() first.');
        }
        return this.client.credentials.isComplete();
    }
    static async getCurrencies(network) {
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
    }
    ;
    async getToken(args) {
        const { token, tokenAddress } = args;
        if (tokenAddress) {
            let tokenObj = await this.getTokenByAddress({ tokenAddress });
            if (!tokenObj) {
                tokenObj = await this.getTokenFromChain({ address: tokenAddress });
            }
            return tokenObj;
        }
        else if (token) {
            return this.getTokenByName({ token });
        }
        return null;
    }
    async getTokenByAddress(args) {
        const { tokenAddress } = args;
        const currencies = await Wallet.getCurrencies(this.network);
        return currencies.find(currency => currency.contractAddress?.toLowerCase() === tokenAddress?.toLowerCase());
    }
    async getTokenByName(args) {
        const { token } = args;
        const chain = this.chain.toUpperCase();
        const currencies = await Wallet.getCurrencies(this.network);
        return currencies.find(c => c.chain === chain && (c.code === token || c.displayCode === token));
    }
    async getTokenFromChain(args) {
        const { address } = args;
        const chain = this.chain.toUpperCase();
        const network = this.network === 'livenet' ? 'mainnet' : this.network;
        const web3 = new crypto_wallet_core_1.Web3(constants_1.Constants.PUBLIC_API[chain][network]);
        const contract = new web3.eth.Contract(erc20Abi_1.ERC20Abi, address);
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
            chain: chain.toUpperCase(),
        };
    }
    async getPasswordWithRetry() {
        let password;
        if (this.isWalletEncrypted()) {
            password = await (0, prompts_1.getPassword)('Wallet password:', {
                hidden: true,
                validate: (input) => {
                    try {
                        __classPrivateFieldGet(this, _Wallet_walletData, "f").key.get(input);
                    }
                    catch {
                        return 'Invalid password. Please try again.';
                    }
                }
            });
        }
        return password;
    }
    async signTxp(args) {
        const { txp } = args;
        if (!this.client) {
            await this.getClient({ mustExist: true });
        }
        const password = await this.getPasswordWithRetry();
        if (__classPrivateFieldGet(this, _Wallet_walletData, "f").key instanceof bitcore_wallet_client_1.TssKey.TssKey) {
            return this._signTxpTss({ txp, password });
        }
        const rootPath = this.client.getRootPath();
        const sigs = await __classPrivateFieldGet(this, _Wallet_walletData, "f").key.sign(rootPath, txp, password);
        return sigs;
    }
    async _signTxpTss(args) {
        const { txp, password } = args;
        const isUtxo = bitcore_wallet_client_1.Utils.isUtxoChain(txp.chain);
        const isEvm = bitcore_wallet_client_1.Utils.isEvmChain(txp.chain);
        const isSvm = bitcore_wallet_client_1.Utils.isSvmChain(txp.chain);
        if (!isEvm) {
            throw new Error('TSS signing is only supported for EVM chains at the moment.');
        }
        const sigs = [];
        const inputPaths = !isUtxo && !Array.isArray(txp.inputPaths) ? ['m/0/0'] : txp.inputPaths;
        for (const i in inputPaths) {
            const derivationPath = inputPaths[i];
            const messageHash = isEvm
                ? crypto_wallet_core_1.ethers.keccak256(Client.getRawTx(txp)[0]).slice(2)
                : 'TODO';
            const signature = await (0, tss_1.sign)({
                host: this.host,
                chain: txp.chain,
                walletData: __classPrivateFieldGet(this, _Wallet_walletData, "f"),
                messageHash: Buffer.from(messageHash, 'hex'),
                derivationPath,
                password,
                id: `${txp.id}:${derivationPath}`,
                logMessageWaiting: `Signing tx input ${i} (${i + 1}/${inputPaths.length}). Waiting for all parties to join...`,
                logMessageCompleted: `Tx input ${i} complete (${i + 1}/${inputPaths.length})`
            });
            sigs.push(signature.signature);
        }
        prompt.log.success('TSS signature(s) generated successfully!');
        return sigs;
    }
    async signAndBroadcastTxp(args) {
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
        }
        catch (err) {
            const refreshedTxp = await this.client.getTx(txp.id);
            if (refreshedTxp.status !== 'broadcasted') {
                throw err;
            }
            return refreshedTxp;
        }
    }
    async signMessage(args) {
        const { message, derivationPath, encoding } = args;
        if (!this.client) {
            await this.getClient({ mustExist: true });
        }
        const password = await this.getPasswordWithRetry();
        const chain = this.client.credentials.chain;
        if (__classPrivateFieldGet(this, _Wallet_walletData, "f").key instanceof bitcore_wallet_client_1.TssKey.TssKey) {
            const messageHash = crypto_wallet_core_1.Message.getMessageHash({ chain, message });
            return this._signMessageWithTss({ messageHash, derivationPath, password, encoding });
        }
        const hdPrivateKey = __classPrivateFieldGet(this, _Wallet_walletData, "f").key.get(password).xPrivKey;
        const fullDerivationPath = this.client.getRootPath() + derivationPath.replace('m', '');
        return crypto_wallet_core_1.Message.signMessageWithPath({ chain, message, derivationPath: fullDerivationPath, hdPrivateKey, encoding });
    }
    async _signMessageWithTss(args) {
        const { messageHash, derivationPath, password, encoding } = args;
        if (!this.isTss()) {
            throw new Error('TSS signing is only supported for TSS wallets.');
        }
        const sig = await (0, tss_1.sign)({
            host: this.host,
            chain: this.client.credentials.chain,
            walletData: __classPrivateFieldGet(this, _Wallet_walletData, "f"),
            messageHash,
            derivationPath,
            password
        });
        const buf = Buffer.from(sig.signature.replace('0x', ''), 'hex');
        return {
            signature: crypto_wallet_core_1.Utils.encodeBuffer(buf, encoding),
            publicKey: sig.publicKey
        };
    }
    async getXPrivKey(password) {
        password = password || await (0, prompts_1.getPassword)();
        return __classPrivateFieldGet(this, _Wallet_walletData, "f").key.get(password).xPrivKey;
    }
    getXPubKey() {
        return this.client.credentials.clientDerivedPublicKey || this.client.credentials.xPubKey;
    }
    isMultiSig() {
        return this.client.credentials.n > 1;
    }
    isTss() {
        return __classPrivateFieldGet(this, _Wallet_walletData, "f").key instanceof bitcore_wallet_client_1.TssKey.TssKey;
    }
    getMinSigners() {
        return __classPrivateFieldGet(this, _Wallet_walletData, "f").key.metadata?.m || this.client.credentials.m || 1;
    }
    isWalletEncrypted() {
        return __classPrivateFieldGet(this, _Wallet_walletData, "f").key.isPrivKeyEncrypted() || __classPrivateFieldGet(this, _Wallet_walletData, "f").key.isKeyChainEncrypted?.();
    }
    isUtxo() {
        return bitcore_wallet_client_1.Utils.isUtxoChain(this.chain);
    }
    isEvm() {
        return bitcore_wallet_client_1.Utils.isEvmChain(this.chain);
    }
    isSvm() {
        return bitcore_wallet_client_1.Utils.isSvmChain(this.chain);
    }
    isXrp() {
        return bitcore_wallet_client_1.Utils.isXrpChain(this.chain);
    }
}
exports.Wallet = Wallet;
_Wallet_walletData = new WeakMap();
;
//# sourceMappingURL=wallet.js.map