var ECDSA = require('../lib/ecdsa');
var Keypair = require('../lib/keypair');
var Hash = require('../lib/hash');

//ECDSA is the signature algorithm used in bitcoin

//start with a keypair that you will use for signing
var keypair = Keypair().fromRandom();

//a message to be signed (normally you would have the hash of a transaction)
var messagebuf = new Buffer('This is a message I would like to sign');

//calculate a 32 byte hash for use in ECDSA. one way to do that is sha256.
var hashbuf = Hash.sha256(messagebuf);

var sig = ECDSA.sign(hashbuf, keypair);

//Anyone with the public key can verify
var pubkey = keypair.pubkey;
console.log('Valid signature? ' + ECDSA.verify(hashbuf, sig, pubkey));

