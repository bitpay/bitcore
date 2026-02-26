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

var validbase58 = require('./data/bitcoind/base58_keys_valid.json');
var invalidbase58 = require('./data/bitcoind/base58_keys_invalid.json');

describe('Address', function() {

  var pubkeyhash = Buffer.from('3d9234bc6ecfba9bc9f1fa8beb75f79b4ac0fc37', 'hex');
  var buf = Buffer.concat([Buffer.from([48]), pubkeyhash]);
  var str = 'LQqWdV81RmiEzXoACvWDQPZEXXU1Q16suH';

  it('can\'t build without data', function() {
    (function() {
      return new Address();
    }).should.throw('First argument is required, please include address data.');
  });

  it('should throw an error because of bad network param', function() {
    (function() {
      return new Address(PKHLivenet[0], 'main', 'pubkeyhash');
    }).should.throw('Second argument must be "livenet" or "testnet".');
  });

  it('should throw an error because of bad type param', function() {
    (function() {
      return new Address(PKHLivenet[0], 'livenet', 'pubkey');
    }).should.throw('Third argument must be "pubkeyhash", "scripthash", "witnesspubkeyhash", or "witnessscripthash".');
  });

  describe('bitcoind compliance', function() {
    validbase58.map(function(d) {
      if (!d[2].isPrivkey) {
        it('should describe address ' + d[0] + ' as valid', function() {
          var type;
          if (d[2].addrType === 'script') {
            type = d[2].isWitness ? 'witnessscripthash' :  'scripthash';
          } else if (d[2].addrType === 'pubkey') {
            type = d[2].isWitness ? 'witnesspubkeyhash' : 'pubkeyhash';
          }
          var network = d[2].network;
          if (network === 'regtest') {
            Networks.enableRegtest();
          } else if (network === 'testnet') {
            Networks.disableRegtest();
          }
          return new Address(d[0], network, type);
        });
      }
    });
    invalidbase58.map(function(d) {
      it('should describe input ' + d[0].slice(0, 10) + '... as invalid', function() {
        expect(function() {
          return new Address(d[0]);
        }).to.throw(Error);
      });
    });
  });

  // livenet valid
  var PKHLivenet = [
    // '15vkcKf7gB23wLAnZLmbVuMiiVDc1Nm4a2',
    // '1A6ut1tWnUq1SEQLMr4ttDh24wcbJ5o9TT',
    // '1BpbpfLdY7oBS9gK7aDXgvMgr1DPvNhEB2',
    // '1Jz2yCRd5ST1p2gUqFB5wsSQfdm3jaFfg7',
    // '    1Jz2yCRd5ST1p2gUqFB5wsSQfdm3jaFfg7   \t\n'
    'Lcyaicjq2aFgcgRX5mDhhQkXN8RFvzWowa',
    'Lc8DoV5XwNoucb9Y8qbgAyen2JMJpkRuBP',
    'LNYX9mArP7rHywh3pjuefKkLf3xd9mp45A',
    'LemWse51VZpctbqxoFq3E7bN1rDR7PhPjz',
    '    LemWse51VZpctbqxoFq3E7bN1rDR7PhPjz   \t\n'
  ];

  // livenet p2sh
  var P2SHLivenet = [
    'MP92ovVhvzHLV6najUeTHuQPuCbqVaULTb',
    'MEauNDgaES2JF4FMsiCjMBJjM8hz3Aw6Xk',
    'MGcaJdHN4jnC584pGefpp73MyMgAD4hGmY',
    'MTENREXMKVQib5jbkW5ywvhFpoz5zDeRgx',
    '\t \nMTENREXMKVQib5jbkW5ywvhFpoz5zDeRgx \r'
  ];

  // testnet p2sh
  var P2SHTestnet = [
    'Qc2auTnCPT7dztNx8zK6vW8nDFZncJeW28',
    'QiTgbQBJxFDLgzswP42ab3BHHg9eNbVjpQ',
    'QgNt5VZHphvA8NUhk6ibugEvTuTrBGGQ7S',
    'QjQhEpoNkejS7qfoDxJfoThiMPTp4yagNV'
  ];

  //livenet bad checksums
  var badChecksums = [
    '15vkcKf7gB23wLAnZLmbVuMiiVDc3nq4a2',
    '1A6ut1tWnUq1SEQLMr4ttDh24wcbj4w2TT',
    '1BpbpfLdY7oBS9gK7aDXgvMgr1DpvNH3B2',
    '1Jz2yCRd5ST1p2gUqFB5wsSQfdmEJaffg7'
  ];

  //livenet non-base58
  var nonBase58 = [
    '15vkcKf7g#23wLAnZLmb$uMiiVDc3nq4a2',
    '1A601ttWnUq1SEQLMr4ttDh24wcbj4w2TT',
    '1BpbpfLdY7oBS9gK7aIXgvMgr1DpvNH3B2',
    '1Jz2yCRdOST1p2gUqFB5wsSQfdmEJaffg7'
  ];

  //testnet valid
  var PKHTestnet = [
    'n4kAh6kPVfDHQjiHbe9iyaVy8vs7E6meWM',
    'mpVMLCqBKSEdz7igmEobXPh3D3mhwCRm2T',
    'mw8PUJzs3BUgu8NK5Bq3vWBciHG4ki8Z7c',
    'n2YnuDaT4k83f7GeKkS3UsaGjeYizYVvgh'
  ];

  describe('validation', function() {

    it('getValidationError detects network mismatchs', function() {
      var error = Address.getValidationError('LQqWdV81RmiEzXoACvWDQPZEXXU1Q16suH', 'testnet');
      should.exist(error);
    });

    it('isValid returns true on a valid address', function() {
      var valid = Address.isValid('LQqWdV81RmiEzXoACvWDQPZEXXU1Q16suH', 'livenet');
      valid.should.equal(true);
    });

    it('isValid returns false on network mismatch', function() {
      var valid = Address.isValid('LQqWdV81RmiEzXoACvWDQPZEXXU1Q16suH', 'testnet');
      valid.should.equal(false);
    });

    it('validates correctly the P2PKH test vector', function() {
      for (var i = 0; i < PKHLivenet.length; i++) {
        var error = Address.getValidationError(PKHLivenet[i]);
        should.not.exist(error);
      }
    });

    it('validates correctly the P2SH test vector', function() {
      for (var i = 0; i < P2SHLivenet.length; i++) {
        var error = Address.getValidationError(P2SHLivenet[i]);
        should.not.exist(error);
      }
    });

    it('validates correctly the P2SH testnet test vector', function() {
      for (var i = 0; i < P2SHTestnet.length; i++) {
        var error = Address.getValidationError(P2SHTestnet[i], 'testnet');
        should.not.exist(error);
      }
    });

    it('rejects correctly the P2PKH livenet test vector with "testnet" parameter', function() {
      for (var i = 0; i < PKHLivenet.length; i++) {
        var error = Address.getValidationError(PKHLivenet[i], 'testnet');
        should.exist(error);
      }
    });

    it('validates correctly the P2PKH livenet test vector with "livenet" parameter', function() {
      for (var i = 0; i < PKHLivenet.length; i++) {
        var error = Address.getValidationError(PKHLivenet[i], 'livenet');
        should.not.exist(error);
      }
    });

    it('should not validate if checksum is invalid', function() {
      for (var i = 0; i < badChecksums.length; i++) {
        var error = Address.getValidationError(badChecksums[i], 'livenet', 'pubkeyhash');
        should.exist(error);
        error.message.should.equal('Checksum mismatch');
      }
    });

    it('should not validate on a network mismatch', function() {
      var error, i;
      for (i = 0; i < PKHLivenet.length; i++) {
        error = Address.getValidationError(PKHLivenet[i], 'testnet', 'pubkeyhash');
        should.exist(error);
        error.message.should.equal('Address has mismatched network type.');
      }
      for (i = 0; i < PKHTestnet.length; i++) {
        error = Address.getValidationError(PKHTestnet[i], 'livenet', 'pubkeyhash');
        should.exist(error);
        error.message.should.equal('Address has mismatched network type.');
      }
    });

    it('should not validate on a type mismatch', function() {
      for (var i = 0; i < PKHLivenet.length; i++) {
        var error = Address.getValidationError(PKHLivenet[i], 'livenet', 'scripthash');
        should.exist(error);
        error.message.should.equal('Address has mismatched type.');
      }
    });

    it('should not validate on non-base58 characters', function() {
      for (var i = 0; i < nonBase58.length; i++) {
        var error = Address.getValidationError(nonBase58[i], 'livenet', 'pubkeyhash');
        should.exist(error);
        error.message.should.equal('Non-base58 character');
      }
    });

    it('testnet addresses are validated correctly', function() {
      for (var i = 0; i < PKHTestnet.length; i++) {
        var error = Address.getValidationError(PKHTestnet[i], 'testnet');
        should.not.exist(error);
      }
    });

    it('addresses with whitespace are validated correctly', function() {
      var ws = '  \r \t    \n LQqWdV81RmiEzXoACvWDQPZEXXU1Q16suH \t \n            \r';
      var error = Address.getValidationError(ws);
      should.not.exist(error);
      Address.fromString(ws).toString().should.equal('LQqWdV81RmiEzXoACvWDQPZEXXU1Q16suH');
    });

    it('testnet addresses are also valid regtest addresses', function() {
      for (var i = 0; i < P2SHTestnet.length; i++) {
        var error = Address.getValidationError(P2SHTestnet[i], 'regtest');
        should.not.exist(error);
      }
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

    it('should error because of unrecognized data format', function() {
      (function() {
        return new Address(new Error());
      }).should.throw(bitcore.errors.InvalidArgument);
    });

    it('should error because of incorrect format for pubkey hash', function() {
      (function() {
        return new Address.fromPublicKeyHash('notahash');
      }).should.throw('Address supplied is not a buffer.');
    });

    it('should error because of incorrect format for script hash', function() {
      (function() {
        return new Address.fromScriptHash('notascript');
      }).should.throw('Address supplied is not a buffer.');
    });

    it('should error because of incorrect type for transform buffer', function() {
      (function() {
        return Address._transformBuffer('notabuffer');
      }).should.throw('Address supplied is not a buffer.');
    });

    it('should error because of incorrect length buffer for transform buffer', function() {
      (function() {
        return Address._transformBuffer(Buffer.alloc(20));
      }).should.throw('Address buffer is incorrect length.');
    });

    it('should error because of incorrect type for pubkey transform', function() {
      (function() {
        return Address._transformPublicKey(Buffer.alloc(20));
      }).should.throw('Address must be an instance of PublicKey.');
    });

    it('should error because of incorrect type for script transform', function() {
      (function() {
        return Address._transformScript(Buffer.alloc(20));
      }).should.throw('Invalid Argument: script must be a Script instance');
    });

    it('should error because of incorrect type for string transform', function() {
      (function() {
        return Address._transformString(Buffer.alloc(20));
      }).should.throw('data parameter supplied is not a string.');
    });

    it('should make an address from a pubkey hash buffer', function() {
      var hash = pubkeyhash; //use the same hash
      var a = Address.fromPublicKeyHash(hash, 'livenet');
      a.network.should.equal(Networks.livenet);
      a.toString().should.equal(str);
      var b = Address.fromPublicKeyHash(hash, 'testnet');
      b.network.should.equal(Networks.testnet);
      b.type.should.equal('pubkeyhash');
      new Address(hash, 'livenet').toString().should.equal(str);
    });

    it('should make an address using the default network', function() {
      var hash = pubkeyhash; //use the same hash
      var network = Networks.defaultNetwork;
      Networks.defaultNetwork = Networks.livenet;
      var a = Address.fromPublicKeyHash(hash);
      a.network.should.equal(Networks.livenet);
      // change the default
      Networks.defaultNetwork = Networks.testnet;
      var b = Address.fromPublicKeyHash(hash);
      b.network.should.equal(Networks.testnet);
      // restore the default
      Networks.defaultNetwork = network;
    });

    it('should throw an error for invalid length hashBuffer', function() {
      (function() {
        return Address.fromPublicKeyHash(buf);
      }).should.throw('Address hashbuffers must be either 20 or 32 bytes.');
    });

    it('should make this address from a compressed pubkey', function() {
      var pubkey = new PublicKey('02cdef48308944b532392bf39b73a6ace72ec30f21a6edad8a76ce896f31fdbeeb');
      var address = Address.fromPublicKey(pubkey, 'livenet');
      address.toString().should.equal('LQqWdV81RmiEzXoACvWDQPZEXXU1Q16suH');
    });

    it('should use the default network for pubkey', function() {
      var pubkey = new PublicKey('02cdef48308944b532392bf39b73a6ace72ec30f21a6edad8a76ce896f31fdbeeb');
      var address = Address.fromPublicKey(pubkey);
      address.network.should.equal(Networks.defaultNetwork);
    });

    it('should make this address from an uncompressed pubkey', function() {
      var pubkey = new PublicKey('04cdef48308944b532392bf39b73a6ace72ec30f21a6edad8a76ce896f31fdbeeb' +
        '1d6319d75adb7a98a225759edf8d4eb0ecc5b250f8823c489f5d4bf1e362f822');
      var a = Address.fromPublicKey(pubkey, 'livenet');
      a.toString().should.equal('LN48GkSqMm7TDToej1vZH6qsvPL45bZAAb');
      var b = new Address(pubkey, 'livenet', 'pubkeyhash');
      b.toString().should.equal('LN48GkSqMm7TDToej1vZH6qsvPL45bZAAb');
    });

    it('should classify from a custom network', function() {
      var custom = {
        name: 'customnetwork',
        pubkeyhash: 0x1c,
        privatekey: 0x1e,
        scripthash: 0x28,
        xpubkey: 0x02e8de8f,
        xprivkey: 0x02e8da54,
        networkMagic: 0x0c110907,
        port: 7333
      };
      var addressString = 'CX4WePxBwq1Y6u7VyMJfmmitE7GiTgC9aE';
      Networks.add(custom);
      var network = Networks.get('customnetwork');
      var address = Address.fromString(addressString);
      address.type.should.equal(Address.PayToPublicKeyHash);
      address.network.should.equal(network);
      Networks.remove(network);
    });

    describe('from a script', function() {
      it('should fail to build address from a non p2sh,p2pkh script', function() {
        var s = new Script('OP_CHECKMULTISIG');
        (function() {
          return new Address(s);
        }).should.throw('needs to be p2pkh in, p2pkh out, p2sh in, or p2sh out');
      });
      it('should make this address from a p2pkh output script', function() {
        var s = new Script('OP_DUP OP_HASH160 20 ' +
          '0xc8e11b0eb0d2ad5362d894f048908341fa61b6e1 OP_EQUALVERIFY OP_CHECKSIG');
        var buf = s.toBuffer();
        var a = Address.fromScript(s, 'livenet');
        a.toString().should.equal('LdY75CNRKwNfGgnVwrfzZbsCSVKKTLTvNT');
        var b = new Address(s, 'livenet');
        b.toString().should.equal('LdY75CNRKwNfGgnVwrfzZbsCSVKKTLTvNT');
      });

      it('should make this address from a p2sh input script', function() {
        var s = Script.fromString('OP_HASH160 20 0xa6ed4af315271e657ee307828f54a4365fa5d20f OP_EQUAL');
        var a = Address.fromScript(s, 'livenet');
        a.toString().should.equal('MP7nffWprdM6CxdxdCAc4ESzb3XsQQPZMp');
        var b = new Address(s, 'livenet');
        b.toString().should.equal('MP7nffWprdM6CxdxdCAc4ESzb3XsQQPZMp');
      });

      it('returns the same address if the script is a pay to public key hash out', function() {
        var address = 'LQqWdV81RmiEzXoACvWDQPZEXXU1Q16suH';
        var script = Script.buildPublicKeyHashOut(new Address(address));
        Address(script, Networks.livenet).toString().should.equal(address);
      });
      it('returns the same address if the script is a pay to script hash out', function() {
        var address = 'MP92ovVhvzHLV6najUeTHuQPuCbqVaULTb';
        var script = Script.buildScriptHashOut(new Address(address));
        Address(script, Networks.livenet).toString().should.equal(address);
      });
    });

    it('should derive from this known address string livenet', function() {
      var address = new Address(str);
      var buffer = address.toBuffer();
      var slice = buffer.slice(1);
      var sliceString = slice.toString('hex');
      sliceString.should.equal(pubkeyhash.toString('hex'));
    });

    it('should derive from this known address string testnet', function() {
      var a = new Address(PKHTestnet[0], 'testnet');
      var b = new Address(a.toString());
      b.toString().should.equal(PKHTestnet[0]);
      b.network.should.equal(Networks.testnet);
    });

    it('should derive from this known address string livenet scripthash', function() {
      var a = new Address(P2SHLivenet[0], 'livenet', 'scripthash');
      var b = new Address(a.toString());
      b.toString().should.equal(P2SHLivenet[0]);
    });

    it('should derive from this known address string testnet scripthash', function() {
      var address = new Address(P2SHTestnet[0], 'testnet', 'scripthash');
      address = new Address(address.toString());
      address.toString().should.equal(P2SHTestnet[0]);
    });

  });

  describe('#toBuffer', function() {

    it('3c3fa3d4adcaf8f52d5b1843975e122548269937 corresponds to hash 16VZnHwRhwrExfeHFHGjwrgEMq8VcYPs9r', function() {
      var address = new Address(str);
      address.toBuffer().slice(1).toString('hex').should.equal(pubkeyhash.toString('hex'));
    });

  });

  describe('#object', function() {

    it('roundtrip to-from-to', function() {
      var obj = new Address(str).toObject();
      var address = Address.fromObject(obj);
      address.toString().should.equal(str);
    });

    it('will fail with invalid state', function() {
      expect(function() {
        return Address.fromObject('¹');
      }).to.throw(bitcore.errors.InvalidState);
    });
  });

  describe('#toString', function() {

    it('livenet pubkeyhash address', function() {
      var address = new Address(str);
      address.toString().should.equal(str);
    });

    it('scripthash address', function() {
      var address = new Address(P2SHLivenet[0]);
      address.toString().should.equal(P2SHLivenet[0]);
    });

    it('testnet scripthash address', function() {
      var address = new Address(P2SHTestnet[0]);
      address.toString().should.equal(P2SHTestnet[0]);
    });

    it('testnet pubkeyhash address', function() {
      var address = new Address(PKHTestnet[0]);
      address.toString().should.equal(PKHTestnet[0]);
    });

  });

  describe('#inspect', function() {
    it('should output formatted output correctly', function() {
      var address = new Address(str);
      var output = '<Address: LQqWdV81RmiEzXoACvWDQPZEXXU1Q16suH, type: pubkeyhash, network: livenet>';
      address.inspect().should.equal(output);
    });
  });

  describe('questions about the address', function() {
    it('should detect a P2SH address', function() {
      new Address(P2SHLivenet[0]).isPayToScriptHash().should.equal(true);
      new Address(P2SHLivenet[0]).isPayToPublicKeyHash().should.equal(false);
      new Address(P2SHTestnet[0]).isPayToScriptHash().should.equal(true);
      new Address(P2SHTestnet[0]).isPayToPublicKeyHash().should.equal(false);
    });
    it('should detect a Pay To PubkeyHash address', function() {
      new Address(PKHLivenet[0]).isPayToPublicKeyHash().should.equal(true);
      new Address(PKHLivenet[0]).isPayToScriptHash().should.equal(false);
      new Address(PKHTestnet[0]).isPayToPublicKeyHash().should.equal(true);
      new Address(PKHTestnet[0]).isPayToScriptHash().should.equal(false);
    });
  });

  it('throws an error if it couldn\'t instantiate', function() {
    expect(function() {
      return new Address(1);
    }).to.throw(TypeError);
  });
  it('can roundtrip from/to a object', function() {
    var address = new Address(P2SHLivenet[0]);
    expect(new Address(address.toObject()).toString()).to.equal(P2SHLivenet[0]);
  });

  it('will use the default network for an object', function() {
    var obj = {
      hash: '19a7d869032368fd1f1e26e5e73a4ad0e474960e',
      type: 'scripthash'
    };
    var address = new Address(obj);
    address.network.should.equal(Networks.defaultNetwork);
  });

  describe('creating a P2SH address from public keys', function() {

    var public1 = '0218ca2f4d5c554a57c060beace3cc8538f451f4e3c069ad22435566a604f1df1c';
    var public2 = '02dbcb2cd9a11ba42670d0f321d9fd5c731cefec00cf74ae8571c089f164cb8075';
    var public3 = '03c6dfe792a4f6a0bde2d112ecb238623ea0c63c9487b668a780fd28bbd8505ccb';
    var publics = [public1, public2, public3];

    it('can create an address from a set of public keys', function() {
      var address = Address.createMultisig(publics, 2, Networks.livenet);
      address.toString().should.equal('MDz7GCyhVk5mHwmxLMHP8heo8kkBhyWNUi');
      address = new Address(publics, 2, Networks.livenet);
      address.toString().should.equal('MDz7GCyhVk5mHwmxLMHP8heo8kkBhyWNUi');
    });

    it('works on testnet also', function() {
      var address = Address.createMultisig(publics, 2, Networks.testnet);
      address.toString().should.equal('QSgw95N1BBnmqQteXhww1hq6AnojTE1BYa');
    });

    it('can create an address from a set of public keys with a nested witness program', function() {
      var address = Address.createMultisig(publics, 2, Networks.livenet, true);
      address.toString().should.equal('MBMR5FPJ9w8jMJc6FRjQFQCHuP6B6k9D4q');
    });

    it('can also be created by Address.createMultisig', function() {
      var address = Address.createMultisig(publics, 2);
      var address2 = Address.createMultisig(publics, 2);
      address.toString().should.equal(address2.toString());
    });

    it('fails if invalid array is provided', function() {
      expect(function() {
        return Address.createMultisig([], 3, 'testnet');
      }).to.throw('Number of required signatures must be less than or equal to the number of public keys');
    });
  });

});
