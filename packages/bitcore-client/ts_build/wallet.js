"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var Bcrypt = __importStar(require("bcrypt"));
var encryption_1 = require("./encryption");
var client_1 = require("./client");
var storage_1 = require("./storage");
var tx_provider_1 = __importDefault(require("./providers/tx-provider"));
var Mnemonic = require('bitcore-mnemonic');
var PrivateKey = require('bitcore-lib').PrivateKey;
var Wallet = (function () {
    function Wallet(params) {
        Object.assign(this, params);
        if (this.baseUrl) {
            this.baseUrl = this.baseUrl + "/" + this.chain + "/" + this.network;
        }
        else {
            this.baseUrl = "https://api.bitcore.io/api/" + this.chain + "/" + this.network;
        }
        this.client = new client_1.Client({
            baseUrl: this.baseUrl,
            authKey: this.getAuthSigningKey()
        });
    }
    Wallet.prototype.saveWallet = function () {
        this.lock();
        return this.storage.saveWallet({ wallet: this });
    };
    Wallet.create = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var chain, network, name, phrase, password, path, storage, mnemonic, hdPrivKey, privKeyObj, authKey, authPubKey, hdPubKey, pubKey, walletEncryptionKey, encryptionKey, encPrivateKey, alreadyExists, err_1, wallet, _a, _b, _c, _d, loadedWallet;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        chain = params.chain, network = params.network, name = params.name, phrase = params.phrase, password = params.password, path = params.path;
                        storage = params.storage;
                        if (!chain || !network || !name) {
                            throw new Error('Missing required parameter');
                        }
                        mnemonic = new Mnemonic(phrase);
                        hdPrivKey = mnemonic.toHDPrivateKey(password);
                        privKeyObj = hdPrivKey.toObject();
                        authKey = new PrivateKey();
                        authPubKey = authKey.toPublicKey().toString();
                        hdPubKey = hdPrivKey.hdPublicKey;
                        pubKey = hdPubKey.publicKey.toString();
                        walletEncryptionKey = encryption_1.Encryption.generateEncryptionKey();
                        encryptionKey = encryption_1.Encryption.encryptEncryptionKey(walletEncryptionKey, password);
                        encPrivateKey = encryption_1.Encryption.encryptPrivateKey(JSON.stringify(privKeyObj), pubKey, walletEncryptionKey);
                        storage =
                            storage ||
                                new storage_1.Storage({
                                    path: path,
                                    errorIfExists: false,
                                    createIfMissing: true
                                });
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 3, , 4]);
                        return [4, this.loadWallet({ storage: storage, name: name, chain: chain, network: network })];
                    case 2:
                        alreadyExists = _e.sent();
                        return [3, 4];
                    case 3:
                        err_1 = _e.sent();
                        return [3, 4];
                    case 4:
                        if (alreadyExists) {
                            throw new Error('Wallet already exists');
                        }
                        _b = (_a = Object).assign;
                        _c = [params];
                        _d = {
                            encryptionKey: encryptionKey,
                            authKey: authKey,
                            authPubKey: authPubKey,
                            masterKey: encPrivateKey
                        };
                        return [4, Bcrypt.hash(password, 10)];
                    case 5:
                        wallet = _b.apply(_a, _c.concat([(_d.password = _e.sent(),
                                _d.xPubKey = hdPubKey.xpubkey,
                                _d.pubKey = pubKey,
                                _d)]));
                        return [4, storage.saveWallet({ wallet: wallet })];
                    case 6:
                        _e.sent();
                        return [4, this.loadWallet({
                                storage: storage,
                                name: name,
                                chain: chain,
                                network: network
                            })];
                    case 7:
                        loadedWallet = _e.sent();
                        console.log(mnemonic.toString());
                        return [4, loadedWallet.register().catch(function (e) {
                                console.debug(e);
                                console.error('Failed to register wallet with bitcore-node.');
                            })];
                    case 8:
                        _e.sent();
                        return [2, loadedWallet];
                }
            });
        });
    };
    Wallet.exists = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var storage, name, chain, network, alreadyExists, err_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        storage = params.storage, name = params.name, chain = params.chain, network = params.network;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4, Wallet.loadWallet({
                                storage: storage,
                                name: name,
                                chain: chain,
                                network: network
                            })];
                    case 2:
                        alreadyExists = _a.sent();
                        return [3, 4];
                    case 3:
                        err_2 = _a.sent();
                        return [3, 4];
                    case 4: return [2, alreadyExists != undefined];
                }
            });
        });
    };
    Wallet.loadWallet = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var chain, network, name, path, storage, loadedWallet;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        chain = params.chain, network = params.network, name = params.name, path = params.path;
                        storage = params.storage;
                        storage =
                            storage ||
                                new storage_1.Storage({ errorIfExists: false, createIfMissing: false, path: path });
                        return [4, storage.loadWallet({ chain: chain, network: network, name: name })];
                    case 1:
                        loadedWallet = _a.sent();
                        return [2, new Wallet(Object.assign(loadedWallet, { storage: storage }))];
                }
            });
        });
    };
    Wallet.prototype.lock = function () {
        this.unlocked = undefined;
    };
    Wallet.prototype.unlock = function (password) {
        return __awaiter(this, void 0, void 0, function () {
            var encMasterKey, validPass, encryptionKey, masterKeyStr, masterKey;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        encMasterKey = this.masterKey;
                        return [4, Bcrypt.compare(password, this.password).catch(function () { return false; })];
                    case 1:
                        validPass = _a.sent();
                        if (!validPass) {
                            throw new Error('Incorrect Password');
                        }
                        return [4, encryption_1.Encryption.decryptEncryptionKey(this.encryptionKey, password)];
                    case 2:
                        encryptionKey = _a.sent();
                        return [4, encryption_1.Encryption.decryptPrivateKey(encMasterKey, this.pubKey, encryptionKey)];
                    case 3:
                        masterKeyStr = _a.sent();
                        masterKey = JSON.parse(masterKeyStr);
                        this.unlocked = {
                            encryptionKey: encryptionKey,
                            masterKey: masterKey
                        };
                        return [2, this];
                }
            });
        });
    };
    Wallet.prototype.register = function (params) {
        if (params === void 0) { params = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var baseUrl, registerBaseUrl, payload;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        baseUrl = params.baseUrl;
                        registerBaseUrl = this.baseUrl;
                        if (!baseUrl) return [3, 2];
                        this.baseUrl = baseUrl;
                        registerBaseUrl = this.baseUrl + "/" + this.chain + "/" + this.network;
                        return [4, this.saveWallet()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        payload = {
                            name: this.name,
                            pubKey: this.authPubKey,
                            path: this.derivationPath,
                            network: this.network,
                            chain: this.chain,
                            baseUrl: registerBaseUrl
                        };
                        return [2, this.client.register({ payload: payload })];
                }
            });
        });
    };
    Wallet.prototype.getAuthSigningKey = function () {
        return new PrivateKey(this.authKey);
    };
    Wallet.prototype.getBalance = function () {
        return this.client.getBalance({ pubKey: this.authPubKey });
    };
    Wallet.prototype.getNetworkFee = function (params) {
        var target = params.target || 2;
        return this.client.getFee({ target: target });
    };
    Wallet.prototype.getUtxos = function (params) {
        var _a = params.includeSpent, includeSpent = _a === void 0 ? false : _a;
        return this.client.getCoins({
            pubKey: this.authPubKey,
            includeSpent: includeSpent
        });
    };
    Wallet.prototype.listTransactions = function (params) {
        return this.client.listTransactions(__assign({}, params, { pubKey: this.authPubKey }));
    };
    Wallet.prototype.newTx = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var utxos, _a, payload;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = params.utxos;
                        if (_a) return [3, 2];
                        return [4, this.getUtxos(params)];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        utxos = _a;
                        payload = {
                            network: this.network,
                            chain: this.chain,
                            recipients: params.recipients,
                            change: params.change,
                            fee: params.fee,
                            utxos: utxos
                        };
                        return [2, tx_provider_1.default.create(payload)];
                }
            });
        });
    };
    Wallet.prototype.broadcast = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var payload;
            return __generator(this, function (_a) {
                payload = {
                    network: this.network,
                    chain: this.chain,
                    rawTx: params.tx
                };
                return [2, this.client.broadcast({ payload: payload })];
            });
        });
    };
    Wallet.prototype.importKeys = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var keys, encryptionKey, keysToSave, addedAddresses;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        keys = params.keys;
                        encryptionKey = this.unlocked.encryptionKey;
                        keysToSave = keys.filter(function (key) { return typeof key.privKey === 'string'; });
                        if (!keysToSave.length) return [3, 2];
                        return [4, this.storage.addKeys({
                                keys: keysToSave,
                                encryptionKey: encryptionKey,
                                name: this.name
                            })];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        addedAddresses = keys.map(function (key) {
                            return { address: key.address };
                        });
                        return [2, this.client.importAddresses({
                                pubKey: this.authPubKey,
                                payload: addedAddresses
                            })];
                }
            });
        });
    };
    Wallet.prototype.signTx = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var tx, utxos, _a, payload, encryptionKey, inputAddresses, keyPromises, keys;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        tx = params.tx;
                        _a = params.utxos;
                        if (_a) return [3, 2];
                        return [4, this.getUtxos(params)];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        utxos = _a;
                        payload = {
                            chain: this.chain,
                            network: this.network,
                            tx: tx,
                            utxos: utxos
                        };
                        encryptionKey = this.unlocked.encryptionKey;
                        inputAddresses = tx_provider_1.default.getSigningAddresses(payload);
                        keyPromises = inputAddresses.map(function (address) {
                            return _this.storage.getKey({
                                address: address,
                                encryptionKey: encryptionKey,
                                chain: _this.chain,
                                network: _this.network,
                                name: _this.name
                            });
                        });
                        return [4, Promise.all(keyPromises)];
                    case 3:
                        keys = _b.sent();
                        return [2, tx_provider_1.default.sign(__assign({}, payload, { keys: keys }))];
                }
            });
        });
    };
    return Wallet;
}());
exports.Wallet = Wallet;
//# sourceMappingURL=wallet.js.map