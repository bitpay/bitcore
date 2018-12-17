"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var crypto = __importStar(require("crypto"));
function shaHash(data, algo) {
    if (algo === void 0) { algo = 'sha256'; }
    var hash = crypto
        .createHash(algo)
        .update(data, 'utf8')
        .digest('hex')
        .toUpperCase();
    return hash;
}
exports.shaHash = shaHash;
var SHA512 = function (data) { return shaHash(data, 'sha512'); };
var SHA256 = function (data) { return shaHash(data, 'sha256'); };
var algo = 'aes-256-cbc';
function encryptEncryptionKey(encryptionKey, password) {
    var password_hash = Buffer.from(SHA512(password));
    var key = password_hash.slice(0, 32);
    var iv = password_hash.slice(32, 48);
    var cipher = crypto.createCipheriv(algo, key, iv);
    var encData = cipher.update(encryptionKey, 'hex', 'hex') + cipher.final('hex');
    return encData;
}
exports.encryptEncryptionKey = encryptEncryptionKey;
function decryptEncryptionKey(encEncryptionKey, password) {
    var password_hash = Buffer.from(SHA512(password));
    var key = password_hash.slice(0, 32);
    var iv = password_hash.slice(32, 48);
    var decipher = crypto.createDecipheriv(algo, key, iv);
    var decrypted = decipher.update(encEncryptionKey, 'hex', 'hex') + decipher.final('hex');
    return decrypted;
}
exports.decryptEncryptionKey = decryptEncryptionKey;
function encryptPrivateKey(privKey, pubKey, encryptionKey) {
    var key = encryptionKey;
    var doubleHash = Buffer.from(SHA256(SHA256(pubKey)), 'hex');
    var iv = doubleHash.slice(0, 16);
    var cipher = crypto.createCipheriv(algo, key, iv);
    var encData = cipher.update(privKey, 'utf8', 'hex') + cipher.final('hex');
    return encData;
}
exports.encryptPrivateKey = encryptPrivateKey;
function decryptPrivateKey(encPrivateKey, pubKey, encryptionKey) {
    var key = Buffer.from(encryptionKey, 'hex');
    var doubleHash = Buffer.from(SHA256(SHA256(pubKey)), 'hex');
    var iv = doubleHash.slice(0, 16);
    var decipher = crypto.createDecipheriv(algo, key, iv);
    var decrypted = decipher.update(encPrivateKey, 'hex', 'utf8') + decipher.final('utf8');
    return decrypted;
}
function generateEncryptionKey() {
    return crypto.randomBytes(32);
}
exports.generateEncryptionKey = generateEncryptionKey;
exports.Encryption = {
    encryptEncryptionKey: encryptEncryptionKey,
    decryptEncryptionKey: decryptEncryptionKey,
    encryptPrivateKey: encryptPrivateKey,
    decryptPrivateKey: decryptPrivateKey,
    generateEncryptionKey: generateEncryptionKey
};
//# sourceMappingURL=encryption.js.map