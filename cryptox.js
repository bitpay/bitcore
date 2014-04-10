// Crypto extensions
//
// PBKDF2 with SHA512

var binding = require('bindings')('cryptox');

exports.pbkdf2_sha512 = function(password, salt, iterations, keylen, callback) {
      if (typeof callback !== 'function')
              throw new Error('No callback provided to pbkdf2');

        return pbkdf2_sha512(password, salt, iterations, keylen, callback);
};


exports.pbkdf2Sync_sha512 = function(password, salt, iterations, keylen) {
      return pbkdf2_sha512(password, salt, iterations, keylen);
};

function toBuf(str, encoding) {
    encoding = encoding || 'binary';
      if (typeof str === 'string') {
            if (encoding === 'buffer')
                    encoding = 'binary';
                str = new Buffer(str, encoding);
                  }
        return str;
}

function pbkdf2_sha512(password, salt, iterations, keylen, callback) {
  password = toBuf(password);
  salt = toBuf(salt);

  if (exports.DEFAULT_ENCODING === 'buffer')
    return binding.PBKDF2(password, salt, iterations, keylen, callback);

  // at this point, we need to handle encodings.
  var encoding = exports.DEFAULT_ENCODING;
  if (callback) {
    binding.PBKDF2_sha512(password, salt, iterations, keylen, function(er, ret) {
      if (ret)
        ret = ret.toString(encoding);
      callback(er, ret);
    });
  } else {
    var ret = binding.PBKDF2_sha512(password, salt, iterations, keylen);
    //return ret.toString(encoding);
    return ret;
  }
}


