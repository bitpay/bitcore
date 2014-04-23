// Crypto extensions
//
// PBKDF2 with SHA512 - browser version

var jssha = require('jssha')

var pbkdf2_sha512 = function (password, salt, keylen, options) {
    password = new Buffer(password);
    salt = new Buffer(salt);
    // Defaults
    var iterations = options && options.iterations || 1;

    // Pseudo-random function
    function PRF(password, salt) {
        var j = new jssha(salt.toString('hex'), 'HEX');
        var hash = j.getHMAC(password.toString('hex'), "HEX", "SHA-512", "HEX");
        return new Buffer(hash, 'hex');
    }

    // Generate key
    var derivedKeyBytes = new Buffer([]),
        blockindex = 1;
    while (derivedKeyBytes.length < keylen) {
        var block = PRF(password, salt.concat([0, 0, 0, blockindex]));
        for (var u = block, i = 1; i < iterations; i++) {
            u = PRF(password, u);
            for (var j = 0; j < block.length; j++) block[j] ^= u[j];
        }
        derivedKeyBytes = derivedKeyBytes.concat(block);
        blockindex++;
    }

    // Truncate excess bytes - TODO
    //derivedKeyBytes.length = keylen;

    return new Buffer(derivedKeyBytes);
};

exports.pbkdf2Sync_sha512 = function(password, salt, iterations, keylen) {
    return pbkdf2_sha512(password, salt, keylen, {iterations: iterations});
};
