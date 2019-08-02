'use strict';

/* jshint maxstatements: 30 */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;

var bitcore = require('..');
var PublicKey = bitcore.PublicKey;
var Address = bitcore.Address;
var Script = bitcore.Script;
var Networks = bitcore.Networks;

describe('Witness Address', function() {

  var pubkeyhash = new Buffer('2a9540f5cd929bf742d16b4e1bf1b0e874c907c9', 'hex');
  var str = 'bc1q9225pawdj2dlwsk3dd8phudsap6vjp7fg3nwdl';
  var buf = Buffer.from(str, 'utf8');

  it('should throw an error because of bad network param', function() {
    (function() {
      return new Address(P2WPKHLivenet[0], 'main', 'witnesspubkeyhash');
    }).should.throw('Second argument must be "livenet" or "testnet".');
  });

  it('should throw an error because of bad type param', function() {
    (function() {
      return new Address(P2WPKHLivenet[0], 'livenet', 'pubkey');
    }).should.throw('Third argument must be "pubkeyhash", "scripthash", "witnesspubkeyhash", or "witnessscripthash".');
  });

  // livenet valid
  var P2WPKHLivenet = [
    'bc1q9225pawdj2dlwsk3dd8phudsap6vjp7fg3nwdl',
    'bc1q9225pawtn2dlwsk3dd8phudsap6vjp7f2h4044',
    'bc1q9225pewdn2dlwsk3dd8phudsap6vjp7f8umq0y',
    'bc1q9225rawdn2dlwsk3dd8phudsap6vjp7fgwh45q',
    '    bc1q92z5pawdn2dlwsk3dd8phudsap6vjp7f82uucr   \t\n'
  ];

  // livenet p2wsh
  var P2WSHLivenet = [
    'bc1q9225pawdn2dlwsk3dd8phudsap6vjp7fhqj5wnrpg457qjq0ycvsdffnze',
    'bc1q9225pawdn2dlwsk3dd8phudsap6vjp7fhqj5wnrpg457qjq0ycvqcgpth2',
    'bc1q9225pawdn2dlwsk3dd8phudsap6vjp7fhqj5wnrpg457qjq0yctsfgd86t',
    'bc1q9225pawdn2dlwsk3dd8phudsap6vjp7fhqj5wnrpg457qjq0yctquf9l0c',
    '\t \nbc1qr225pawdn2dlwsk3dd8phudsap6vjp7fhqj5wnrpg457qjq0yctqtdwmes \r'
  ];

  // testnet p2Wsh
  var P2WSHTestnet = [
    'tb1q9225pawdn2dlwsk3dd8phudsap6vjp7fhqj5wnrpg457qjq0ycvs6pluck',
    'tb1q9225pawdn2dlwsk3dd8phudsap6vjp7fhqj5wnrpg457qjq0ycvq0qhyd9',
    'tb1q9225pawdn2dlwsk3dd8phudsap6vjp7fhqj5wnrpg457qjq0ycts7qmgqy',
    'tb1q9225pawdn2dlwsk3dd8phudsap6vjp7fhqj5wnrpg457qjq0yctqtpns4h'
  ];

  //livenet bad checksums
  var badChecksums = [
    'bc1q9225pawdj2dlwsk3dd8phudsap6vjp7fg3nwdd',
    'bc1q9225pawtn2dlwsk3dd8phudsap6vjp7f2h4040',
    'bc1q9225pewdn2dlwsk3dd8phudsap6vjp7f8umq00',
    'bc1q9225rawdn2dlwsk3dd8phudsap6vjp7fgwh455'
  ];

  //testnet valid
  var P2WPKHTestnet = [
    'tb1q5lrlddcjejvu0qyx0f5fg59zj89danlxtt058g',
    'tb1qrqsut4l6payxr9zda6s74jsgupc096t40k234h',
    'tb1qkjxpx3kzdqj3qydxfsd88rj8vwzy2ry9luturg',
    'tb1qa38kkwah0mncpn29j6xlzv4xa5m3wrr0juyt2j'
  ];

  describe('validation', function() {

    it('getValidationError detects network mismatchs', function() {
      var error = Address.getValidationError('bc1q9225pawdj2dlwsk3dd8phudsap6vjp7fg3nwdl', 'testnet');
      should.exist(error);
    });

    it('isValid returns true on a valid address', function() {
      var valid = Address.isValid('bc1q9225pawdj2dlwsk3dd8phudsap6vjp7fg3nwdl', 'livenet');
      valid.should.equal(true);
    });

    it('isValid returns false on network mismatch', function() {
      var valid = Address.isValid('bc1q9225pawdj2dlwsk3dd8phudsap6vjp7fg3nwdl', 'testnet');
      valid.should.equal(false);
    });

    it('validates correctly the P2WPKH test vector', function() {
      for (var i = 0; i < P2WPKHLivenet.length; i++) {
        var error = Address.getValidationError(P2WPKHLivenet[i]);
        should.not.exist(error);
      }
    });

    it('validates correctly the P2WSH test vector', function() {
      for (var i = 0; i < P2WSHLivenet.length; i++) {
        var error = Address.getValidationError(P2WSHLivenet[i]);
        should.not.exist(error);
      }
    });

    it('validates correctly the P2WSH testnet test vector', function() {
      for (var i = 0; i < P2WSHTestnet.length; i++) {
        var error = Address.getValidationError(P2WSHTestnet[i], 'testnet');
        should.not.exist(error);
      }
    });

    it('rejects correctly the P2WPKH livenet test vector with "testnet" parameter', function() {
      for (var i = 0; i < P2WPKHLivenet.length; i++) {
        var error = Address.getValidationError(P2WPKHLivenet[i], 'testnet');
        should.exist(error);
      }
    });

    it('validates correctly the P2WPKH livenet test vector with "livenet" parameter', function() {
      for (var i = 0; i < P2WPKHLivenet.length; i++) {
        var error = Address.getValidationError(P2WPKHLivenet[i], 'livenet');
        should.not.exist(error);
      }
    });

    it('should not validate if checksum is invalid', function() {
      for (var i = 0; i < badChecksums.length; i++) {
        var error = Address.getValidationError(badChecksums[i], 'livenet', 'witnesspubkeyhash');
        should.exist(error);
        error.message.should.equal('Invalid checksum for ' + badChecksums[i]);
      }
    });

    it('should not validate on a network mismatch', function() {
      var error, i;
      for (i = 0; i < P2WPKHLivenet.length; i++) {
        error = Address.getValidationError(P2WPKHLivenet[i], 'testnet', 'witnesspubkeyhash');
        should.exist(error);
        error.message.should.equal('Address has mismatched network type.');
      }
      for (i = 0; i < P2WPKHTestnet.length; i++) {
        error = Address.getValidationError(P2WPKHTestnet[i], 'livenet', 'witnesspubkeyhash');
        should.exist(error);
        error.message.should.equal('Address has mismatched network type.');
      }
    });

    it('should not validate on a type mismatch', function() {
      for (var i = 0; i < P2WPKHLivenet.length; i++) {
        var error = Address.getValidationError(P2WPKHLivenet[i], 'livenet', 'witnessscripthash');
        should.exist(error);
        error.message.should.equal('Address has mismatched type.');
      }
    });

    it('testnet addresses are validated correctly', function() {
      for (var i = 0; i < P2WPKHTestnet.length; i++) {
        var error = Address.getValidationError(P2WPKHTestnet[i], 'testnet');
        should.not.exist(error);
      }
    });

    it('addresses with whitespace are validated correctly', function() {
      var ws = '  \r \t    \n bc1q9225pawdj2dlwsk3dd8phudsap6vjp7fg3nwdl \t \n            \r';
      var error = Address.getValidationError(ws);
      should.not.exist(error);
      Address.fromString(ws).toString().should.equal('bc1q9225pawdj2dlwsk3dd8phudsap6vjp7fg3nwdl');
    });
  });

  describe('instantiation', function() {
    it('can be instantiated from another address', function() {
      var address = Address.fromBuffer(buf);
      var address2 = new Address({
        hashBuffer: address.hashBuffer,
        network: address.network,
        type: address.type
      });
      address.toString().should.equal(address2.toString());
    });
  });

  describe('encodings', function() {

    it('should make an address from a buffer', function() {
      Address.fromBuffer(buf).toString().should.equal(str);
      new Address(buf).toString().should.equal(str);
      new Address(buf).toString().should.equal(str);
    });

    it('should make an address from a string', function() {
      Address.fromString(str).toString().should.equal(str);
      new Address(str).toString().should.equal(str);
    });

    it('should make an address using a non-string network', function() {
      Address.fromString(str, Networks.livenet).toString().should.equal(str);
    });

    it('should throw with bad network param', function() {
      (function(){
        Address.fromString(str, 'somenet');
      }).should.throw('Unknown network');
    });

    it('should classify from a custom network', function() {
      var custom = {
        name: 'customnetwork2',
        pubkeyhash: 0x1c,
        privatekey: 0x1e,
        scripthash: 0x28,
        bech32prefix: 'abc',
        xpubkey: 0x02e8de8f,
        xprivkey: 0x02e8da54,
        networkMagic: 0x0c110907,
        port: 7333
      };
      var addressString = 'abc1q9225pawdj2dlwsk3dd8phudsap6vjp7fzfr9m9';
      Networks.add(custom);
      var network = Networks.get('customnetwork2');
      var address = Address.fromString(addressString);
      address.type.should.equal(Address.PayToWitnessPublicKeyHash);
      address.network.should.equal(network);
      Networks.remove(network);
    });

    describe('from a script', function() {
      it('should make this address from a p2wpkh output script', function() {
        var s = new Script('OP_0 20 ' +
          '0x2a9540f5cd929bf742d16b4e1bf1b0e874c907c9');
        var buf = s.toBuffer();
        var a = Address.fromScript(s, 'livenet');
        a.toString().should.equal('bc1q9225pawdj2dlwsk3dd8phudsap6vjp7fg3nwdl');
        var b = new Address(s, 'livenet');
        b.toString().should.equal('bc1q9225pawdj2dlwsk3dd8phudsap6vjp7fg3nwdl');
      });

      it('should make this address from a p2wsh input script', function() {
        var s = Script.fromString('OP_0 32 0x2a9540f5cd9a9bf742d16b4e1bf1b0e874c907c9b825474c614569e0480f2619');
        var a = Address.fromScript(s, 'livenet');
        a.toString().should.equal('bc1q9225pawdn2dlwsk3dd8phudsap6vjp7fhqj5wnrpg457qjq0ycvsdffnze');
        var b = new Address(s, 'livenet');
        b.toString().should.equal('bc1q9225pawdn2dlwsk3dd8phudsap6vjp7fhqj5wnrpg457qjq0ycvsdffnze');
      });

      it('returns the same address if the script is a pay to witness public key hash out', function() {
        var address = 'bc1q9225pawdj2dlwsk3dd8phudsap6vjp7fg3nwdl';
        var script = Script.buildWitnessV0Out(new Address(address));
        Address(script, Networks.livenet).toString().should.equal(address);
      });
      it('returns the same address if the script is a pay to witness script hash out', function() {
        var address = 'bc1q9225pawdn2dlwsk3dd8phudsap6vjp7fhqj5wnrpg457qjq0ycvsdffnze';
        var script = Script.buildWitnessV0Out(new Address(address));
        Address(script, Networks.livenet).toString().should.equal(address);
      });
    });

    it('should derive from this known address string livenet', function() {
      var address = new Address(str);
      var buffer = address.toBuffer();
      buffer.toString().should.equal(Buffer.from(str, 'utf8').toString());
    });

    it('should derive from this known address string testnet', function() {
      var a = new Address(P2WPKHTestnet[0], 'testnet');
      var b = new Address(a.toString());
      b.toString().should.equal(P2WPKHTestnet[0]);
      b.network.should.equal(Networks.testnet);
    });

    it('should derive from this known address string livenet witness scripthash', function() {
      var a = new Address(P2WSHLivenet[0], 'livenet', 'witnessscripthash');
      var b = new Address(a.toString());
      b.toString().should.equal(P2WSHLivenet[0]);
    });

    it('should derive from this known address string testnet witness scripthash', function() {
      var address = new Address(P2WSHTestnet[0], 'testnet', 'witnessscripthash');
      address = new Address(address.toString());
      address.toString().should.equal(P2WSHTestnet[0]);
    });

  });

  describe('#toBuffer', function() {

    it('2a9540f5cd929bf742d16b4e1bf1b0e874c907c9 corresponds to hash bc1q9225pawdj2dlwsk3dd8phudsap6vjp7fg3nwdl', function() {
      var address = new Address(str);
      var fromBuffer = new Address(address.toBuffer())
      address.hashBuffer.toString('hex').should.equal(pubkeyhash.toString('hex'));
    });

  });

  describe('#object', function() {

    it('roundtrip to-from-to', function() {
      var obj = new Address(str).toObject();
      var address = Address.fromObject(obj);
      address.toString().should.equal(str);
    });
  });

  describe('#toString', function() {

    it('livenet witnesspubkeyhash address', function() {
      var address = new Address(str);
      address.toString().should.equal(str);
    });

    it('witnessscripthash address', function() {
      var address = new Address(P2WSHLivenet[0]);
      address.toString().should.equal(P2WSHLivenet[0]);
    });

    it('testnet witnessscripthash address', function() {
      var address = new Address(P2WSHTestnet[0]);
      address.toString().should.equal(P2WSHTestnet[0]);
    });

    it('testnet witnesspubkeyhash address', function() {
      var address = new Address(P2WPKHTestnet[0]);
      address.toString().should.equal(P2WPKHTestnet[0]);
    });

  });

  describe('#inspect', function() {
    it('should output formatted output correctly', function() {
      var address = new Address(str);
      var output = '<Address: bc1q9225pawdj2dlwsk3dd8phudsap6vjp7fg3nwdl, type: witnesspubkeyhash, network: livenet>';
      address.inspect().should.equal(output);
    });
  });

  describe('questions about the address', function() {
    it('should detect a P2WSH address', function() {
      new Address(P2WSHLivenet[0]).isPayToWitnessScriptHash().should.equal(true);
      new Address(P2WSHLivenet[0]).isPayToWitnessPublicKeyHash().should.equal(false);
      new Address(P2WSHTestnet[0]).isPayToWitnessScriptHash().should.equal(true);
      new Address(P2WSHTestnet[0]).isPayToWitnessPublicKeyHash().should.equal(false);
    });
    it('should detect a Pay To Witness PubkeyHash address', function() {
      new Address(P2WPKHLivenet[0]).isPayToWitnessPublicKeyHash().should.equal(true);
      new Address(P2WPKHLivenet[0]).isPayToWitnessScriptHash().should.equal(false);
      new Address(P2WPKHTestnet[0]).isPayToWitnessPublicKeyHash().should.equal(true);
      new Address(P2WPKHTestnet[0]).isPayToWitnessScriptHash().should.equal(false);
    });
  });

  it('can roundtrip from/to a object', function() {
    var address = new Address(P2WSHLivenet[0]);
    expect(new Address(address.toObject()).toString()).to.equal(P2WSHLivenet[0]);
  });

  it('will use the default network for an object', function() {
    var obj = {
      hash: '2a9540f5cd9a9bf742d16b4e1bf1b0e874c907c9b825474c614569e0480f2619',
      type: 'witnessscripthash'
    };
    var address = new Address(obj);
    address.network.should.equal(Networks.defaultNetwork);
  });

});
