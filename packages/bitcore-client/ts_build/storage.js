"use strict";
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
var os = __importStar(require("os"));
var fs = __importStar(require("fs"));
var levelup_1 = __importDefault(require("levelup"));
var leveldown_1 = __importDefault(require("leveldown"));
var encryption_1 = require("./encryption");
var bitcoreLib = require('bitcore-lib');
var StorageCache = {};
var Storage = (function () {
    function Storage(params) {
        var path = params.path, createIfMissing = params.createIfMissing, errorIfExists = params.errorIfExists;
        var basePath;
        if (!path) {
            basePath = os.homedir() + "/.bitcore";
            try {
                fs.mkdirSync(basePath);
            }
            catch (e) {
                if (e.errno !== -17) {
                    console.error('Unable to create bitcore storage directory');
                }
            }
        }
        this.path = path || basePath + "/bitcoreWallet";
        if (!createIfMissing) {
            var walletExists = fs.existsSync(this.path) &&
                fs.existsSync(this.path + '/LOCK') &&
                fs.existsSync(this.path + '/LOG');
            if (!walletExists) {
                throw new Error('Not a valid wallet path');
            }
        }
        if (StorageCache[this.path]) {
            this.db = StorageCache[this.path];
        }
        else {
            this.db = StorageCache[this.path] = levelup_1.default(leveldown_1.default(this.path), {
                createIfMissing: createIfMissing,
                errorIfExists: errorIfExists
            });
        }
    }
    Storage.prototype.loadWallet = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var name, wallet;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        name = params.name;
                        return [4, this.db.get("wallet|" + name)];
                    case 1:
                        wallet = (_a.sent());
                        if (!wallet) {
                            return [2];
                        }
                        return [2, JSON.parse(wallet)];
                }
            });
        });
    };
    Storage.prototype.listWallets = function () {
        return this.db.createValueStream({
            gt: Buffer.from('walle'),
            lt: Buffer.from('wallf')
        });
    };
    Storage.prototype.saveWallet = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var wallet;
            return __generator(this, function (_a) {
                wallet = params.wallet;
                return [2, this.db.put("wallet|" + wallet.name, JSON.stringify(wallet))];
            });
        });
    };
    Storage.prototype.getKey = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var address, name, encryptionKey, payload, json, encKey, pubKey, decrypted;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        address = params.address, name = params.name, encryptionKey = params.encryptionKey;
                        return [4, this.db.get("key|" + name + "|" + address)];
                    case 1:
                        payload = (_a.sent());
                        json = JSON.parse(payload) || payload;
                        encKey = json.encKey, pubKey = json.pubKey;
                        if (encryptionKey && pubKey) {
                            decrypted = encryption_1.Encryption.decryptPrivateKey(encKey, Buffer.from(pubKey, 'hex'), Buffer.from(encryptionKey, 'hex'));
                            return [2, JSON.parse(decrypted)];
                        }
                        else {
                            return [2, json];
                        }
                        return [2];
                }
            });
        });
    };
    Storage.prototype.addKeys = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var name, keys, encryptionKey, ops;
            return __generator(this, function (_a) {
                name = params.name, keys = params.keys, encryptionKey = params.encryptionKey;
                ops = keys.map(function (key) {
                    var pubKey = key.pubKey;
                    pubKey =
                        pubKey || new bitcoreLib.PrivateKey(key.privKey).publicKey.toString();
                    var payload = {};
                    if (pubKey && key.privKey && encryptionKey) {
                        var encKey = encryption_1.Encryption.encryptPrivateKey(JSON.stringify(key), Buffer.from(pubKey, 'hex'), Buffer.from(encryptionKey, 'hex'));
                        payload = { encKey: encKey, pubKey: pubKey };
                    }
                    return {
                        type: 'put',
                        key: "key|" + name + "|" + key.address,
                        value: JSON.stringify(payload)
                    };
                });
                return [2, this.db.batch(ops)];
            });
        });
    };
    return Storage;
}());
exports.Storage = Storage;
//# sourceMappingURL=storage.js.map