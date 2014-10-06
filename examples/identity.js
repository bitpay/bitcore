var Identity = require('../lib/identity');
var KeyPair  = require('../lib/keypair');

var keypair = new KeyPair().fromRandom();

console.log( 'keypair:' , keypair );
console.log( 'public key:' , keypair.pubkey.toString() );

var identity = new Identity().fromPubkey( keypair.pubkey );

console.log( 'identity:' , identity );
console.log( 'identity string:' , identity.toString() );
