var run = function() {
  bitcore = typeof(bitcore) === 'undefined' ? require('../bitcore') : bitcore;

  console.log('ECIES: Elliptic Curve Integrated Encryption Scheme');
  console.log('A way of encrypting with a public key and decrypting with a private key.');

  var key = bitcore.Key.generateSync();
  console.log('Private key: ' + key.private.toString('hex'));
  console.log('Public key: ' + key.public.toString('hex'));

  var message = new Buffer('This is a message to be encrypted');
  console.log('Message: "' + message.toString() + '"');

  var encrypted = bitcore.ECIES.encrypt(key.public, message);
  console.log('Encrypted (with public key): ' + encrypted.toString('hex'));

  var decrypted = bitcore.ECIES.decrypt(key.private, encrypted);
  console.log('Decrypted (with private key): "' + decrypted.toString() + '"');
};


// This is just for browser & mocha compatibility
if (typeof module !== 'undefined') {
  module.exports.run = run;
  if (require.main === module) {
    run();
  }
} else {
  run();
}
