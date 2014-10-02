var Identity = require('../lib/identity');
var Keypair = require('../lib/keypair');

var keypair  = new Keypair();
var identity = new Identity().fromPubkey( keypair.pubkey );

console.log( identity.toString() );
