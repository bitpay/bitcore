// Crypto extensions
//
// PBKDF2 with SHA512 - browser version

var sjcl = require('../sjcl');

var hmacSHA512 = function (key) {
    var hasher = new sjcl.misc.hmac( key, sjcl.hash.sha512 );
    this.encrypt = function () {
        return hasher.encrypt.apply( hasher, arguments );
    };
};

exports.pbkdf2Sync_sha512 = function(password, salt, iterations, keylen) {
    var derivedKey = sjcl.misc.pbkdf2( password, salt, iterations, 512, hmacSHA512 );
    return sjcl.codec.hex.fromBits( derivedKey )
};
