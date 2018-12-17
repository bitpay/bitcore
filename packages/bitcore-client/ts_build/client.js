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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var request_promise_native_1 = __importDefault(require("request-promise-native"));
var request_1 = __importDefault(require("request"));
var secp256k1 = __importStar(require("secp256k1"));
var stream = __importStar(require("stream"));
var url_1 = require("url");
var bitcoreLib = require('bitcore-lib');
var Client = (function () {
    function Client(params) {
        this.getAddressTxos = function (params) {
            return __awaiter(this, void 0, void 0, function () {
                var unspent, address, args, url;
                return __generator(this, function (_a) {
                    unspent = params.unspent, address = params.address;
                    args = unspent ? "?unspent=" + unspent : '';
                    url = this.baseUrl + "/address/" + address + args;
                    return [2, request_promise_native_1.default.get(url, {
                            json: true
                        })];
                });
            });
        };
        Object.assign(this, params);
    }
    Client.prototype.sign = function (params) {
        var method = params.method, url = params.url, _a = params.payload, payload = _a === void 0 ? {} : _a;
        var parsedUrl = new url_1.URL(url);
        var message = [
            method,
            parsedUrl.pathname + parsedUrl.search,
            JSON.stringify(payload)
        ].join('|');
        var privateKey = this.authKey.toBuffer();
        var messageHash = bitcoreLib.crypto.Hash.sha256sha256(Buffer.from(message));
        return secp256k1.sign(messageHash, privateKey).signature.toString('hex');
    };
    Client.prototype.register = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var payload, _a, baseUrl, url, signature;
            return __generator(this, function (_b) {
                payload = params.payload;
                _a = payload.baseUrl, baseUrl = _a === void 0 ? this.baseUrl : _a;
                url = baseUrl + "/wallet";
                signature = this.sign({ method: 'POST', url: url, payload: payload });
                console.log(url);
                return [2, request_promise_native_1.default.post(url, {
                        headers: { 'x-signature': signature },
                        body: payload,
                        json: true
                    })];
            });
        });
    };
    Client.prototype.getBalance = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var payload, pubKey, url, signature;
            return __generator(this, function (_a) {
                payload = params.payload, pubKey = params.pubKey;
                url = this.baseUrl + "/wallet/" + pubKey + "/balance";
                signature = this.sign({ method: 'GET', url: url, payload: payload });
                return [2, request_promise_native_1.default.get(url, {
                        headers: { 'x-signature': signature },
                        body: payload,
                        json: true
                    })];
            });
        });
    };
    Client.prototype.getCoins = function (params) {
        var payload = params.payload, pubKey = params.pubKey, includeSpent = params.includeSpent;
        var url = this.baseUrl + "/wallet/" + pubKey + "/utxos?includeSpent=" + includeSpent;
        var signature = this.sign({ method: 'GET', url: url, payload: payload });
        return request_1.default.get(url, {
            headers: { 'x-signature': signature },
            body: payload,
            json: true
        });
    };
    Client.prototype.listTransactions = function (params) {
        var pubKey = params.pubKey, startBlock = params.startBlock, startDate = params.startDate, endBlock = params.endBlock, endDate = params.endDate, includeMempool = params.includeMempool;
        var url = this.baseUrl + "/wallet/" + pubKey + "/transactions?";
        if (startBlock) {
            url += "startBlock=" + startBlock + "&";
        }
        if (endBlock) {
            url += "endBlock=" + endBlock + "&";
        }
        if (startDate) {
            url += "startDate=" + startDate + "&";
        }
        if (endDate) {
            url += "endDate=" + endDate + "&";
        }
        if (includeMempool) {
            url += 'includeMempool=true';
        }
        var signature = this.sign({ method: 'GET', url: url });
        return request_1.default.get(url, {
            headers: { 'x-signature': signature },
            json: true
        });
    };
    Client.prototype.getFee = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var target, url;
            return __generator(this, function (_a) {
                target = params.target;
                url = this.baseUrl + "/fee/" + target;
                return [2, request_promise_native_1.default.get(url, {
                        json: true
                    })];
            });
        });
    };
    Client.prototype.importAddresses = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var payload, pubKey, url, signature;
            return __generator(this, function (_a) {
                payload = params.payload, pubKey = params.pubKey;
                url = this.baseUrl + "/wallet/" + pubKey;
                signature = this.sign({ method: 'POST', url: url, payload: payload });
                return [2, new Promise(function (resolve) {
                        var dataStream = new stream.Readable({ objectMode: true });
                        dataStream
                            .pipe(request_promise_native_1.default.post(url, {
                            headers: {
                                'x-signature': signature,
                                'content-type': 'application/octet-stream'
                            }
                        }))
                            .on('end', resolve);
                        var jsonData = JSON.stringify(payload);
                        dataStream.push(jsonData);
                        dataStream.push(null);
                    })];
            });
        });
    };
    Client.prototype.broadcast = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var payload, url;
            return __generator(this, function (_a) {
                payload = params.payload;
                url = this.baseUrl + "/tx/send";
                return [2, request_promise_native_1.default.post(url, { body: payload, json: true })];
            });
        });
    };
    return Client;
}());
exports.Client = Client;
//# sourceMappingURL=client.js.map