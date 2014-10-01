var Pubkey = require('../lib/pubkey');
var Address = require('../lib/address');
var Stealthkey = require('../lib/expmt/stealthkey');
var StealthAddress = require('../lib/expmt/stealthaddress');
var StealthMessage = require('../lib/expmt/stealthmessage');
var Keypair = require('../lib/keypair')

//First, the person receiving must make a stealth key.

var sk = Stealthkey().fromRandom();

//It has an associated stealth address.

var sa = StealthAddress().fromStealthkey(sk);

console.log('Stealth address: ' + sa);

//Now make a message.

var messagebuf = new Buffer('Hello there. Only you know this message is to you, and only you know what it says.');

//Encrypt the message with the stealth address.

var encbuf = StealthMessage.encrypt(messagebuf, sa);

console.log('Hex of the encrypted message: ' + encbuf.toString('hex'));

//Note that the first 20 bytes are a pubkeyhash, which may be interpreted as a bitcoin address.
//This address has never been seen before in public.

var address = Address().set({hashbuf: encbuf.slice(0, 20)});

console.log('The randomly generated address the message is to: ' + address);

//And the next 33 bytes are a nonce public key, which the message is "from".
//It has never been seen before in public.

var pubkey = Pubkey().fromDER(encbuf.slice(20, 20 + 33));

console.log('Nonce public key: ' + pubkey);

//The owner of the stealth key can check to see if it is for them.

console.log('Is the message for me? ' + (StealthMessage.isForMe(encbuf, sk) ? "yes" : "no"));

//The owner can decrypt it.

var messagebuf2 = StealthMessage.decrypt(encbuf, sk);

console.log('Decrypted message: ' + messagebuf2.toString());

//If you do not have the payload privkey, you can still use isForMe.
sk.payloadKeypair.privkey = undefined;

console.log('Without payload privkey, is the message for me? ' + (StealthMessage.isForMe(encbuf, sk) ? "yes" : "no"));

//...but not decrypt

try {
  StealthMessage.decrypt(encbuf, sk);
} catch (e) {
  console.log("...but without the payload privkey, I can't decrypt.");
}
