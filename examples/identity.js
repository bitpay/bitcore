var Identity = require('../lib/identity');
var Keypair  = require('../lib/keypair');

var pubkeyhash = new Buffer('3c3fa3d4adcaf8f52d5b1843975e122548269937', 'hex');
var buf = Buffer.concat([new Buffer([0]), pubkeyhash]);

var keypair  = new Keypair().fromString( buf.toString('hex') );
var identity = new Identity().fromPubkey( keypair.pubkey );

console.log( 'pubkey',  keypair.pubkey.toString() );
console.log( 'privkey', keypair.privkey.toString() );
console.log( identity );
console.log( identity.toString() );
