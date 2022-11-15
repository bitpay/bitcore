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
var validCashAddr = require('./data/cashaddr.json')

describe('Address', function() {

  var pubkeyhash = Buffer.from('3c3fa3d4adcaf8f52d5b1843975e122548269937', 'hex');
  var buf = Buffer.concat([Buffer.from([28]), pubkeyhash]);
  var str = 'bitcoincash:qq7rlg754h903afdtvvy8967zgj5sf5exueg36nyc7';

  it('can\'t build without data', function() {
    (function() {
      return new Address();
    }).should.throw('First argument is required, please include address data.');
  });

  it('should throw an error because of bad network param', function() {
    (function() {
      return new Address(PKHLivenet[0], 'main', 'pubkeyhash');
    }).should.throw('Second argument must be "livenet", "testnet", or "regtest".');
  });

  it('should throw an error because of bad type param', function() {
    (function() {
      return new Address(PKHLivenet[0], 'livenet', 'pubkey');
    }).should.throw('Third argument must be "pubkeyhash" or "scripthash"');
  });

  describe('bitcoind compliance', function() {
    validbase58.map(function(d) {
      if (!d[2].isPrivkey) {
        it('should describe address ' + d[0] + ' as valid', function() {
          var type;
          if (d[2].addrType === 'script') {
            type = 'scripthash';
          } else if (d[2].addrType === 'pubkey') {
            type = 'pubkeyhash';
          }
          var network = 'livenet';
          if (d[2].isTestnet) {
            network = 'testnet';
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

  describe('Cashaddr', function() {

    //from https://github.com/Bitcoin-UAHF/spec/blob/master/cashaddr.md#examples-of-address-translation
    //
    //
    var t = [
      ['CTH8H8Zj6DSnXFBKQeDG28ogAS92iS16Bp', 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a'],
      ['Cazk5ZxnJGY1iYqqTefvo7ZtwLYx3YzjgY', 'bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy'],
      ['CGZpaFRaJYHqohPJ8BKYvKmxffV2dcmmN9', 'bitcoincash:qqq3728yw0y47sqn6l2na30mcw6zm78dzqre909m2r'],
      ['HHLN6S9BcP1JLSrMhgD5qe57iVEMFMLCBT', 'bitcoincash:ppm2qsznhks23z7629mms6s4cwef74vcwvn0h829pq'],
      ['HR3ytsYEpS6XXkWskgfkccqLVPeGdXQ1S8', 'bitcoincash:pr95sy3j9xwd2ap32xkykttr4cvcu7as4yc93ky28e'],
      ['H6d4PZ12phrMcu4LRDKNjq3QDiaMDz3fUd', 'bitcoincash:pqq3728yw0y47sqn6l2na30mcw6zm78dzq5ucqzc37'],
    ];
    var i;

    for (i = 0; i < t.length; i++) {
      var legacyaddr = t[i][0];
      var cashaddr = t[i][1];
      it('should convert ' + legacyaddr, function() {
        var a = new Address(legacyaddr);
        a.toCashAddress().should.equal(cashaddr);
      });
    }


    for (i = 0; i < t.length; i++) {
      var legacyaddr = t[i][0];
      var cashaddr = t[i][1];
      it('should convert ' + cashaddr, function() {
        var a = new Address(cashaddr);
        a.toLegacyAddress().should.equal(legacyaddr);
      });
    }

    for (i = 0; i < t.length; i++) {
      var legacyaddr2 = t[i][0];
      var cashaddr2 = t[i][1].toUpperCase();
      it('should convert UPPERCASE addresses ' + cashaddr2, function() {
        var a = new Address(cashaddr2);
        a.toLegacyAddress().should.equal(legacyaddr2);
      });
    }


    for (i = 0; i < t.length; i++) {
      var legacyaddr3 = t[i][0];
      var cashaddr3 = t[i][1].split(':')[1];
      it('should convert no prefix addresses ' + cashaddr3, function() {
        var a = new Address(cashaddr3);
        a.toObject().network.should.equal('livenet');
        a.toLegacyAddress().should.equal(legacyaddr3);
      });
    }

    it('should be able to convert a testnet address to a cashaddr', function() {
      var a = new Address('mysKEM9kN86Nkcqwb4gw7RqtDyc552LQoq');
      a.toCashAddress().should.equal('bchtest:qry5cr6h2qe25pzwwfrz8m653fh2tf6nusj9dl0ujc');
    });


    it('should be able to convert a testnet address to a cashaddr without prefix', function() {
      var a = new Address('mysKEM9kN86Nkcqwb4gw7RqtDyc552LQoq');
      a.toCashAddress(true).should.equal('qry5cr6h2qe25pzwwfrz8m653fh2tf6nusj9dl0ujc');
    });

    it('should be able to convert a testnet address to a cashaddr with prefix', function() {
      var a = new Address('mysKEM9kN86Nkcqwb4gw7RqtDyc552LQoq');
      a.toCashAddress().should.equal('bchtest:qry5cr6h2qe25pzwwfrz8m653fh2tf6nusj9dl0ujc');
    });

    it('should fail convert no prefix addresses bad checksum ', function() {
      (function() {
        var a = new Address('qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx7');
      }).should.throw('Invalid checksum');
    });

    it('should fail convert a mixed case addresses ', function() {
      (function() {
        var a = new Address('qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6A');
      }).should.throw('Invalid Argument: Mixed case');
    });
  });


  // livenet valid
  var PKHLivenet = [
    'CMPeBN1BZDzaqU5DF66X5QykLcS1voucT9',
    'bitcoincash:qp3awknl3dz8ezu3rmapff3phnzz95kansf0r3rs4x',
    'CTHVPhghRAmiLHajoKYTGRyiU8RomQmAfZ',
    'CaSvYEmgxVRYiAauWzW1XP4SHkyTiS78yy',
    '    CaSvYEmgxVRYiAauWzW1XP4SHkyTiS78yy   \t\n'
  ];

  // livenet p2sh
  var P2SHLivenet = [
    'bitcoincash:pqv60krfqv3k3lglrcnwtee6ftgwgaykpccr8hujjz',
    'H8kzbJ9Mw46WdAxC8SAFadHn1oNqp6jEsu',
    'HCGvZEM8pNyAFBfRrz9Eo4N4eGJPuFahd9',
    'HVZezVtqnDwoTZTZ997fZUUGZMetDFUDLf',
    '\tHVZezVtqnDwoTZTZ997fZUUGZMetDFUDLf \n \r'
  ];

  // testnet p2sh
  var P2SHTestnet = [
    'bchtest:pzvmx80heyrg69ypkkt90rwmknfmmy96av8f02lrrf',
    '2NEWDzHWwY5ZZp8CQWbB7ouNMLqCia6YRda',
    '2MxgPqX1iThW3oZVk9KoFcE5M4JpiETssVN',
    '2NB72XtkjpnATMggui83aEtPawyyKvnbX2o'
  ];

  //livenet bad checksums
  var badChecksums = [
    'C5vkcKf7gB23wLAnZLmbVuMiiVDc3nq4a2',
    'CA6ut1tWnUq1SEQLMr4ttDh24wcbj4w2TT',
    'CBpbpfLdY7oBS9gK7aDXgvMgr1DpvNH3B2',
    'CJz2yCRd5ST1p2gUqFB5wsSQfdmEJaffg7'
  ];

  //livenet non-base58
  var nonBase58 = [
    'C5vkcKf7g#23wLAnZLmb$uMiiVDc3nq4a2',
    'CA601ttWnUq1SEQLMr4ttDh24wcbj4w2TT',
    'CBpbpfLdY7oBS9gK7aIXgvMgr1DpvNH3B2',
    'CJz2yCRdOST1p2gUqFB5wsSQfdmEJaffg7'
  ];

  //testnet valid
  var PKHTestnet = [
    'bchtest:qr3pswmv0t332gwaedmuhqcp59gswsu2ysdn664dvs',
    'n45x3R2w2jaSC62BMa9MeJCd3TXxgvDEmm',
    'mursDVxqNQmmwWHACpM9VHwVVSfTddGsEM',
    'bchtest:qz82yclajj49kq3cnqk5khs9h2qx5drfruglvwmnac'
  ];

  describe('validation', function() {

    it('getValidationError detects network mismatchs', function() {
      var error = Address.getValidationError('HC1hAdrx7APHg1DkE4bVLsZhY1SE5Dik1r', 'testnet');
      should.exist(error);
    });

    it('isValid returns true on a valid livenet address', function() {
      Address.isValid('HC1hAdrx7APHg1DkE4bVLsZhY1SE5Dik1r', 'livenet').should.equal(true);
    });

    it('isValid returns false on network mismatch', function() {
      Address.isValid('HC1hAdrx7APHg1DkE4bVLsZhY1SE5Dik1r', 'testnet').should.equal(false);
      Address.isValid('HC1hAdrx7APHg1DkE4bVLsZhY1SE5Dik1r', 'regtest').should.equal(false);
    });

    it('isValid returns true on network match on cashaddr', function() {
      Address.isValid('bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a', 'mainnet').should.equal(true);
      Address.isValid('bchreg:qrjf2q4j0vx7xwqlnzcuy56vk9j9an0z458k0lrw3m', 'regtest').should.equal(true);
      Address.isValid('bchtest:qrzm24wqva0gnvgcsyc0h8tdpgw462mgmc9lef83vw', 'testnet').should.equal(true);
    });

    it('isValid returns false on network mismatch on cashaddr', function() {
      Address.isValid('bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a', 'testnet').should.equal(false);
      Address.isValid('bchreg:qrjf2q4j0vx7xwqlnzcuy56vk9j9an0z458k0lrw3m', 'testnet').should.equal(false);
      Address.isValid('bchtest:qrzm24wqva0gnvgcsyc0h8tdpgw462mgmc9lef83vw', 'mainnet').should.equal(false);
    });

    it('isValid returns true on regtest address', function() {
      Address.isValid('qqww7zk6w7e6eu6299cwcu45ymwx7rmt3ckhj4xs0d', 'regtest').should.equal(true);
      Address.isValid('qqww7zk6w7e6eu6299cwcu45ymwx7rmt3ckhj4xs0d', 'testnet').should.equal(false);
      Address.isValid('qqww7zk6w7e6eu6299cwcu45ymwx7rmt3ckhj4xs0d', 'mainnet').should.equal(false);
    });

    it('isValid works as expected even after enableRegtest() is called', function() {
      Networks.enableRegtest();
      Address.isValid('bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a', 'mainnet').should.equal(true);
      Address.isValid('bchreg:qrjf2q4j0vx7xwqlnzcuy56vk9j9an0z458k0lrw3m', 'regtest').should.equal(true);
      Address.isValid('bchtest:qrzm24wqva0gnvgcsyc0h8tdpgw462mgmc9lef83vw', 'testnet').should.equal(true);
      Address.isValid('bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a', 'testnet').should.equal(false);
      Address.isValid('bchreg:qrjf2q4j0vx7xwqlnzcuy56vk9j9an0z458k0lrw3m', 'testnet').should.equal(false);
      Address.isValid('bchtest:qrzm24wqva0gnvgcsyc0h8tdpgw462mgmc9lef83vw', 'mainnet').should.equal(false);
      Networks.disableRegtest();
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
        error.message.should.match(/Checksum mismatch/);
      }
    });

    it('should not validate on a network mismatch', function() {
      var error,
        i;
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
        error.message.should.match(/Non-base58/);
      }
    });

    it('testnet addresses are validated correctly', function() {
      for (var i = 0; i < PKHTestnet.length; i++) {
        var error = Address.getValidationError(PKHTestnet[i], 'testnet');
        should.not.exist(error);
      }
    });

    it('addresses with whitespace are validated correctly', function() {
      var ws = '  \r \t    \n bitcoincash:qp3awknl3dz8ezu3rmapff3phnzz95kansf0r3rs4x \t \n            \r';
      var error = Address.getValidationError(ws);
      should.not.exist(error);
      Address.fromString(ws).toString().should.equal('bitcoincash:qp3awknl3dz8ezu3rmapff3phnzz95kansf0r3rs4x');
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
      (function() {
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
      }).should.throw('Address buffers must be exactly 21 bytes.');
    });

    it('should error because of incorrect type for pubkey transform', function() {
      (function() {
        return Address._transformPublicKey(Buffer.alloc(20));
      }).should.throw('Address must be an instance of PublicKey.');
    });

    it('should error because of incorrect type for script transform', function() {
      (function() {
        return Address._transformScript( Buffer.alloc(20));
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
      }).should.throw('Address hashbuffers must be exactly 20 bytes.');
    });

    it('should make this address from a compressed pubkey', function() {
      var pubkey = new PublicKey('0285e9737a74c30a873f74df05124f2aa6f53042c2fc0a130d6cbd7d16b944b004');
      var address = Address.fromPublicKey(pubkey, 'livenet');
      address.toString().should.equal('bitcoincash:qp0jaf7jwcf0zlxguv7kcaj05hsxz2lcquxxcxmxtv');
    });

    it('should use the default network for pubkey', function() {
      var pubkey = new PublicKey('0285e9737a74c30a873f74df05124f2aa6f53042c2fc0a130d6cbd7d16b944b004');
      var address = Address.fromPublicKey(pubkey);
      address.network.should.equal(Networks.defaultNetwork);
    });

    it('should make this address from an uncompressed pubkey', function() {
      var pubkey = new PublicKey('0485e9737a74c30a873f74df05124f2aa6f53042c2fc0a130d6cbd7d16b944b00' +
        '4833fef26c8be4c4823754869ff4e46755b85d851077771c220e2610496a29d98');
      var a = Address.fromPublicKey(pubkey, 'livenet');
      a.toString().should.equal('bitcoincash:qqazje5ucx2l672lc8cundsa5q9lwdm3rcknh40sxg');
      var b = new Address(pubkey, 'livenet', 'pubkeyhash');
      b.toString().should.equal('bitcoincash:qqazje5ucx2l672lc8cundsa5q9lwdm3rcknh40sxg');
    });

    it('should classify from a custom network', function() {
      var custom = {
        name: 'customnetwork',
        pubkeyhash: 10,
        privatekey: 0x1e,
        scripthash: 15,
        xpubkey: 0x02e8de8f,
        xprivkey: 0x02e8da54,
        networkMagic: 0x0c110907,
        port: 7333
      };
      Networks.add(custom);
      var addressString = '57gZdnwcQHLirKLwDHcFiWLq9jTZwRaxaE';
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
        var a = Address.fromScript(s, 'livenet');
        a.toString().should.equal('bitcoincash:qrywzxcwkrf265mzmz20qjyssdql5cdkuyz47850l7');
        var b = new Address(s, 'livenet');
        b.toString().should.equal('bitcoincash:qrywzxcwkrf265mzmz20qjyssdql5cdkuyz47850l7');
      });

      it('should make this address from a p2sh input script', function() {
        var s = Script.fromString('OP_HASH160 20 0xa6ed4af315271e657ee307828f54a4365fa5d20f OP_EQUAL');
        var a = Address.fromScript(s, 'livenet');
        a.toString().should.equal('bitcoincash:pznw6jhnz5n3uet7uvrc9r655sm9lfwjpu4ufgvysw');
        var b = new Address(s, 'livenet');
        b.toString().should.equal('bitcoincash:pznw6jhnz5n3uet7uvrc9r655sm9lfwjpu4ufgvysw');
      });

      it('returns the same address if the script is a pay to public key hash out', function() {
        var address = 'bitcoincash:qqazje5ucx2l672lc8cundsa5q9lwdm3rcknh40sxg';
        var script = Script.buildPublicKeyHashOut(new Address(address));
        Address(script, Networks.livenet).toString().should.equal(address);
      });
      it('returns the same address if the script is a pay to script hash out', function() {
        var address = 'bitcoincash:ppkzrtrs0jeheyreg222ekspzpsw7r7qzykvzs4uxh';
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
      var output = '<Address: bitcoincash:qq7rlg754h903afdtvvy8967zgj5sf5exueg36nyc7, type: pubkeyhash, network: livenet>';
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

    var public1 = '02da5798ed0c055e31339eb9b5cef0d3c0ccdec84a62e2e255eb5c006d4f3e7f5b';
    var public2 = '0272073bf0287c4469a2a011567361d42529cd1a72ab0d86aa104ecc89342ffeb0';
    var public3 = '02738a516a78355db138e8119e58934864ce222c553a5407cf92b9c1527e03c1a2';
    var publics = [public1, public2, public3];

    it('can create an address from a set of public keys', function() {
      var address = Address.createMultisig(publics, 2, Networks.livenet);
      address.toString().should.equal('bitcoincash:pzdumagr7ru8w46s8alws4lzruv2c75vsuulp7g59n');
      address = new Address(publics, 2, Networks.livenet);
      address.toString().should.equal('bitcoincash:pzdumagr7ru8w46s8alws4lzruv2c75vsuulp7g59n');
    });

    it('works on testnet also', function() {
      var address = Address.createMultisig(publics, 2, Networks.testnet);
      address.toString().should.equal('bchtest:pzdumagr7ru8w46s8alws4lzruv2c75vsucd9e2rz0');
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

  describe('cashaddr test vectors', function () {
    it('should validate each test vector', function () {
      // vectors from here:
      // https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki
      // the test vectors include a number of addresses with type "15" which is not explained in the spec,
      // so those are skipped
      for (var i in validCashAddr) {
        var obj = validCashAddr[i]
        var payloadSize = obj.payloadSize
        var type = obj.type
        var cashaddr = obj.cashaddr
        var payload = obj.payload
        if (type === 15) continue // unknown type - not described in spec
        var info = Address._decodeCashAddress(cashaddr)
        info.type.should.equal(type === 0 ? 'pubkeyhash': 'scripthash')
        info.hashBuffer.toString('hex').should.equal(payload.toLowerCase())
        info.hashBuffer.length.should.equal(payloadSize)
      }
    })
  })
});
