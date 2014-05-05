var Armory = require('../lib/Armory');
var Address = require('../lib/Address');
var Point = require('../lib/Point');
var bignum = require('bignum');
var Key = require('../lib/Key');

// Chain code can be generated from paper backup
// on brainwallet.org/#chains
//
// Paper backup used for testing:
//
// aagh hjfj sihk ietj giik wwai awtd uodh hnji
// soss uaku egod utai itos fijj ihgi jhau jtoo
var chaincode = '84ac14bc4b388b33da099a0b4ee3b507284d99e1476639e36e5ca5e6af86481e';

// Initial public key can be retrieved from paper backup
//var PublicX = '9df5 23e7 18b9 1f59 a790 2d46 999f 9357 ccf8 7208 24d4 3076 4516 b809 f7ab ce4e'
//var PublicY = '66ba 5d21 4682 0dae 401d 9506 8437 2516 79f9 0c56 4186 cc50 07df c6d0 6989 1ff4';
//var pubkey = '04' + PublicX.split(' ').join('') + PublicY.split(' ').join('');

// mmm... can't figure out how to arrive at same pubkey as brainwallet
var pubkey = '045a09a3286873a72f164476bde9d1d8e5c2bc044e35aa47eb6e798e325a86417f7c35b61d9905053533e0b4f2a26eca0330aadf21c638969e45aaace50e4c0c87';

var armory = new Armory(chaincode, pubkey);

var pubkey;
for (var i = 0; i < 5; i++) {
  armory = armory.next();
  console.log(Address.fromPubKey(armory.pubkey).as('base58'));
}
