var Identity = require('../lib/identity');
var KeyPair  = require('../lib/keypair');
var Hash     = require('../lib/hash');

var keypair = new KeyPair().fromRandom();

console.log( 'keypair:' , keypair );
console.log( 'private key:' , keypair.privkey.toString('hex') );
console.log( 'public key:' , keypair.pubkey.toString('hex') );
console.log( 'public hash:' , Hash.sha256ripemd160( keypair.pubkey.toBuffer() ).toString('hex') );


var identity = new Identity().fromPubkey( keypair.pubkey );

keypair.pubkey.compressed = false;
var identityComp = new Identity().fromPubkey( keypair.pubkey );

console.log( 'identity:' , identity );
console.log( 'identity string:' , identity.toString() );
console.log( 'identity string, compressed:' , identityComp.toString() );
