'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');

var should = chai.should();

var Script = bitcore.Script;
var Address = bitcore.Address;
var Opcode = bitcore.Opcode;
var Transaction = bitcore.Transaction;
var networks = bitcore.networks;
var testdata = testdata || require('./testdata');

describe('Script', function() {
  it('should be able to create class', function() {
    should.exist(Script);
  });
  it('should be able to create instance', function() {
    var s = new Script();
    should.exist(s);
  });
  it('should be able to create Script from Address', function() {
    var addr = new Address('1J57QmkaQ6JohJoQyaUJwngJ2vTQ3C6gHi');
    var script = Script.createPubKeyHashOut(addr.payload());
    should.exist(script);
    script.isPubkeyHash().should.be.true;
  });
  it('isP2SH should work', function() {
    var addr = new Address('1J57QmkaQ6JohJoQyaUJwngJ2vTQ3C6gHi');
    var script = Script.createPubKeyHashOut(addr.payload());
    script.isP2SH().should.be.false;
  });

  describe('#finishedMultiSig', function() {
    it('should report that this scriptSig has finished being signed', function() {
      var scriptHex = '00493046022100954d2aa7af9a2de34b04e4151842933df81acc379580cd0c057883cfb0994a8b022100de1530692eda9cdb567c94e05fc856cfbc26fcf3482148bde85f143032f4902501483045022100d164d174118497d93e0062b573be78d4b9417aee09889cd242a966af73367917022054f095be0bce9edee556a2216239fcad45a7a64d8fb318dc5375c9159724689a014c695221033e4cc6b6ee8d8ce3335fed6d4917b2bbbac0f5743b2ced101ba036f95c51e59421023147410ce15e0a31c2bb970cdf01517266dc2c9182f5938636ed363cfd4cc3ae210342a3c8a4b20c7a122a011a07063df04e4c5ad520a1302a2a66e174fd9b0d4ea453ae';
      //decoded: 0 3046022100954d2aa7af9a2de34b04e4151842933df81acc379580cd0c057883cfb0994a8b022100de1530692eda9cdb567c94e05fc856cfbc26fcf3482148bde85f143032f4902501 3045022100d164d174118497d93e0062b573be78d4b9417aee09889cd242a966af73367917022054f095be0bce9edee556a2216239fcad45a7a64d8fb318dc5375c9159724689a01 5221033e4cc6b6ee8d8ce3335fed6d4917b2bbbac0f5743b2ced101ba036f95c51e59421023147410ce15e0a31c2bb970cdf01517266dc2c9182f5938636ed363cfd4cc3ae210342a3c8a4b20c7a122a011a07063df04e4c5ad520a1302a2a66e174fd9b0d4ea453ae
      //meaning: OP_0 sig sig serialized_script
      var scriptBuf = new Buffer(scriptHex, 'hex');
      var script = new Script(scriptBuf);
      script.finishedMultiSig().should.equal(true);
    });
    it('should report that this scripSig has not finished being signed', function() {
      var scriptHex = '00483045022100aac57f3ba004e6265097b759d92132c43fb5dcb033c2a3f6e61caa5e05e6b97e02200dae579e54c8e733d222eae5bbbaf557bbcf03271cf76775c91744c24a99916b014c69522103197599f6e209cefef07da2fddc6fe47715a70162c531ffff8e611cef23dfb70d210392dccb2ed470a45984811d6402fdca613c175f8f3e4eb8e2306e8ccd7d0aed032103e085eb6fa1f20b2722c16161144314070a2c316a9cae2489fd52ce5f63fff6e453ae';
      //decoded: 0 3045022100aac57f3ba004e6265097b759d92132c43fb5dcb033c2a3f6e61caa5e05e6b97e02200dae579e54c8e733d222eae5bbbaf557bbcf03271cf76775c91744c24a99916b01 522103197599f6e209cefef07da2fddc6fe47715a70162c531ffff8e611cef23dfb70d210392dccb2ed470a45984811d6402fdca613c175f8f3e4eb8e2306e8ccd7d0aed032103e085eb6fa1f20b2722c16161144314070a2c316a9cae2489fd52ce5f63fff6e453ae
      //meaning: sig place_holder place_holder serialized_script
      var scriptBuf = new Buffer(scriptHex, 'hex');
      var script = new Script(scriptBuf);
      script.finishedMultiSig().should.equal(false);
    });
  });

  describe('#getMultiSigInfo', function() {
    it('should report the expected pubkeys', function() {
      // using same test case as used in #createMultisig
      // 3 of 5 multisig, unsorted
      // test case generated with: bitcoind createmultisig 3 '["02c525d65d18be8fb36ab50a21bee02ac9fdc2c176fa18791ac664ea4b95572ae0", "02b937d54b550a3afdc2819772822d25869495f9e588b56a0205617d80514f0758", "0266dd7664e65958f3cc67bf92ad6243bc495df5ab56691719263977104b635bea","02ee91377073b04d1d9d19597b81a7be3db6554bd7d16151cb5599a6107a589e70", "02c8f63ad4822ef360b5c300f08488fa0fa24af2b2bebb6d6b602ca938ee5af793"]'
      var scriptHex = '532102c525d65d18be8fb36ab50a21bee02ac9fdc2c176fa18791ac664ea4b95572ae02102b937d54b550a3afdc2819772822d25869495f9e588b56a0205617d80514f0758210266dd7664e65958f3cc67bf92ad6243bc495df5ab56691719263977104b635bea2102ee91377073b04d1d9d19597b81a7be3db6554bd7d16151cb5599a6107a589e702102c8f63ad4822ef360b5c300f08488fa0fa24af2b2bebb6d6b602ca938ee5af79355ae';
      var scriptBuf = new Buffer(scriptHex, 'hex');
      var script = new Script(scriptBuf);
      var info = script.getMultiSigInfo();

      info.nsigs.should.equal(3);
      info.npubkeys.should.equal(5);

      info.pubkeys.length.should.equal(info.npubkeys);
      info.pubkeys.map(function(pubkey) {
        testPubKeysHex.indexOf(pubkey.toString('hex')).should.not.equal(-1);
      });
    });
  });

  describe('prependOp0', function() {
    it('should prepend the script with OP_0', function() {
      var scriptHex = '483045022002da7fae9b98615115b7e9a4f1d9efd581463b670f91ec6404a14cb6fc9c4531022100ff449d72ba4e72deb4317267e2d38cec9fd2f58a9afa39c9f5e35f5678694ff50100004c695221033e4cc6b6ee8d8ce3335fed6d4917b2bbbac0f5743b2ced101ba036f95c51e59421023147410ce15e0a31c2bb970cdf01517266dc2c9182f5938636ed363cfd4cc3ae210342a3c8a4b20c7a122a011a07063df04e4c5ad520a1302a2a66e174fd9b0d4ea453ae';
      //decoded: 3045022002da7fae9b98615115b7e9a4f1d9efd581463b670f91ec6404a14cb6fc9c4531022100ff449d72ba4e72deb4317267e2d38cec9fd2f58a9afa39c9f5e35f5678694ff501 0 0 5221033e4cc6b6ee8d8ce3335fed6d4917b2bbbac0f5743b2ced101ba036f95c51e59421023147410ce15e0a31c2bb970cdf01517266dc2c9182f5938636ed363cfd4cc3ae210342a3c8a4b20c7a122a011a07063df04e4c5ad520a1302a2a66e174fd9b0d4ea453ae
      //meaning: sig place_holder place_holder serialized_script
      var scriptBuf = new Buffer(scriptHex, 'hex');
      var script = new Script(scriptBuf);
      script.prependOp0();
      script.chunks[0].should.equal(0);
    });
  });

  describe('#parse', function() {
    it('should parse this valid script', function() {
      var scriptHex = '6a0843435000010001004c75726c3d687474702533612532662532666c6f63616c686f7374253361343636313125326663253266324d794a6e5065774c5a6241596a6843666f695652526679733937746d5231516d4b61';
      var script = new Script(new Buffer(scriptHex, 'hex'));
      should.exist(script);
      script.chunks[2].length.should.equal(75);
    });
  });

  testdata.dataScriptAll.forEach(function(datum) {
    if (datum.length < 2) throw new Error('Invalid test data');
    var human = datum[0] + ' ' + datum[1];
    it('should parse script from human readable ' + human, function() {
      var script = Script.fromHumanReadable(human);
      var h2 = script.toHumanReadable();
      Script.fromHumanReadable(h2).toHumanReadable().should.equal(h2);
    });
  });

  // Original test from https://github.com/ryanxcharles/treasure
  var testPubKeysHex = [
    '02c525d65d18be8fb36ab50a21bee02ac9fdc2c176fa18791ac664ea4b95572ae0',
    '02b937d54b550a3afdc2819772822d25869495f9e588b56a0205617d80514f0758',
    '0266dd7664e65958f3cc67bf92ad6243bc495df5ab56691719263977104b635bea',
    '02ee91377073b04d1d9d19597b81a7be3db6554bd7d16151cb5599a6107a589e70',
    '02c8f63ad4822ef360b5c300f08488fa0fa24af2b2bebb6d6b602ca938ee5af793'
  ];

  describe('#_sortKeys', function() {
    it('should get the pubkeys in properly sorted order', function() {
      var pubs = testPubKeysHex.map(function(hex) {
        return new Buffer(hex, 'hex');
      });
      var sorted = Script._sortKeys(pubs);
      sorted[0].toString('hex').should.equal(testPubKeysHex[2]);
      sorted[1].toString('hex').should.equal(testPubKeysHex[1]);
      sorted[2].toString('hex').should.equal(testPubKeysHex[0]);
      sorted[3].toString('hex').should.equal(testPubKeysHex[4]);
      sorted[4].toString('hex').should.equal(testPubKeysHex[3]);
    });
  });

  describe('#createMultisig', function() {
    it('should create ', function() {
      var pubs = testPubKeysHex.map(function(hex) {
        return new Buffer(hex, 'hex');
      });
      // 3 of 5 multisig, unsorted
      // test case generated with: bitcoind createmultisig 3 '["02c525d65d18be8fb36ab50a21bee02ac9fdc2c176fa18791ac664ea4b95572ae0", "02b937d54b550a3afdc2819772822d25869495f9e588b56a0205617d80514f0758", "0266dd7664e65958f3cc67bf92ad6243bc495df5ab56691719263977104b635bea","02ee91377073b04d1d9d19597b81a7be3db6554bd7d16151cb5599a6107a589e70", "02c8f63ad4822ef360b5c300f08488fa0fa24af2b2bebb6d6b602ca938ee5af793"]'
      var s1 = Script.createMultisig(3, pubs, {
        noSorting: true
      });
      s1.getBuffer().toString('hex').should.equal('532102c525d65d18be8fb36ab50a21bee02ac9fdc2c176fa18791ac664ea4b95572ae02102b937d54b550a3afdc2819772822d25869495f9e588b56a0205617d80514f0758210266dd7664e65958f3cc67bf92ad6243bc495df5ab56691719263977104b635bea2102ee91377073b04d1d9d19597b81a7be3db6554bd7d16151cb5599a6107a589e702102c8f63ad4822ef360b5c300f08488fa0fa24af2b2bebb6d6b602ca938ee5af79355ae');

      // 3 of 5 multisig, sorted
      // test case generated with: bitcoind createmultisig 3 '["0266dd7664e65958f3cc67bf92ad6243bc495df5ab56691719263977104b635bea", "02b937d54b550a3afdc2819772822d25869495f9e588b56a0205617d80514f0758", "02c525d65d18be8fb36ab50a21bee02ac9fdc2c176fa18791ac664ea4b95572ae0", "02c8f63ad4822ef360b5c300f08488fa0fa24af2b2bebb6d6b602ca938ee5af793", "02ee91377073b04d1d9d19597b81a7be3db6554bd7d16151cb5599a6107a589e70"]'
      var s2 = Script.createMultisig(3, pubs);
      s2.getBuffer().toString('hex').should.equal('53210266dd7664e65958f3cc67bf92ad6243bc495df5ab56691719263977104b635bea2102b937d54b550a3afdc2819772822d25869495f9e588b56a0205617d80514f07582102c525d65d18be8fb36ab50a21bee02ac9fdc2c176fa18791ac664ea4b95572ae02102c8f63ad4822ef360b5c300f08488fa0fa24af2b2bebb6d6b602ca938ee5af7932102ee91377073b04d1d9d19597b81a7be3db6554bd7d16151cb5599a6107a589e7055ae');

    });
  });


  describe('#countMissingSignatures', function() {
    it('should count missing signature in empty scripts', function() {
      var s = new Script();
      s.countMissingSignatures().should.equal(1);
    });
    it('should count missing signatures p2sh 2-3 1 missing', function() {
      // from https://gist.github.com/matiu/11182987
      var b = new Buffer('00483045022100aac57f3ba004e6265097b759d92132c43fb5dcb033c2a3f6e61caa5e05e6b97e02200dae579e54c8e733d222eae5bbbaf557bbcf03271cf76775c91744c24a99916b014c69522103197599f6e209cefef07da2fddc6fe47715a70162c531ffff8e611cef23dfb70d210392dccb2ed470a45984811d6402fdca613c175f8f3e4eb8e2306e8ccd7d0aed032103e085eb6fa1f20b2722c16161144314070a2c316a9cae2489fd52ce5f63fff6e453ae', 'hex');
      var s = new Script(b);
      s.countMissingSignatures().should.equal(1);
      s.countSignatures().should.equal(1);
    });

    it('should count missing signatures p2sh 2-3 0 missing', function() {
      // from https://gist.github.com/matiu/11182987
      var b = new Buffer('00483045022100aac57f3ba004e6265097b759d92132c43fb5dcb033c2a3f6e61caa5e05e6b97e02200dae579e54c8e733d222eae5bbbaf557bbcf03271cf76775c91744c24a99916b01483045022100a505aff6a1d9cc14d0658a99ebcf1901b5c9f9e6408055fa9b9da443c80bfdb602207f0391c98abecc93bc3b353c55ada4d3fb6d4bab48fd63ae184df1af367cee46014c69522103197599f6e209cefef07da2fddc6fe47715a70162c531ffff8e611cef23dfb70d210392dccb2ed470a45984811d6402fdca613c175f8f3e4eb8e2306e8ccd7d0aed032103e085eb6fa1f20b2722c16161144314070a2c316a9cae2489fd52ce5f63fff6e453ae', 'hex');
      var s = new Script(b);
      s.countMissingSignatures().should.equal(0);
      s.countSignatures().should.equal(2);
    });
  });


  describe('#isMultiSig', function() {
    it('should return true for valid multisig scripts', function() {
      var pubs = testPubKeysHex.map(function(hex) {
        return new Buffer(hex, 'hex');
      });
      var s1 = Script.createMultisig(3, pubs, {
        noSorting: true
      });
      s1.isMultiSig().should.equal(true);
    });
    it('should return false for invalid multisig scripts', function() {
      (new Script(new Buffer('000000ae', 'hex'))).isMultiSig().should.equal(false);
      var s = new Script(new Buffer('522103bb52138972c48a132fc1f637858c5189607dd0f7fe40c4f20f6ad65f2d389ba42103bb52138972c48a132fc1f637858c5189607dd0f7fe40c4f20f6ad65f2d389ba45f6054ae', 'hex'));

      (new Script(new Buffer('522103bb52138972c48a132fc1f637858c5189607dd0f7fe40c4f20f6ad65f2d389ba42103bb52138972c48a132fc1f637858c5189607dd0f7fe40c4f20f6ad65f2d389ba45f6054ae', 'hex'))).isMultiSig().should.equal(false);

    });
  });
  describe('ScriptSig validations', function() {
    var pkhss = '4730440220150eccaec1e5d9104434544bf820b1e24c94e0da7a768d62260b57b9f02877db02204d5d193e833099adb0bf38a610d314936fb70671383d2fa6e09586bc77abe3f9012103146226860c4f62b1ab79bdbb0d3145bf1dc1a0cfa7bf35f2aa30e8432717ac72'
    var p2shss = '004930460221008d36f82425396aff3797aed0651954b5bd2bf8768baf358fbeef9994a282d639022100e3967e55972a99b37da210e9a01c580dc3e0e4df8dc9f5a87ba4338c8fc9e5ba0147304402201aafdf74d2dc5d9d78baadd3beb2e565b0ed14489ad2f1434f9b51ad9b4fa7df02204de4400a1e6817c0883cae056baab77986e65a65aac885020d29d4ddafe30960014c69522103909e13a508df9edd35c806b4d0993bca644e69963041aa93dc209105cfd39b282103b3805706833fab77ae3ad3be1117bf797b460bd58c901f5e12721975d89aff8f2103d442f2fe27171b5d1404a9d7ca943e01951fdc103a25bd89089eb88b5a3e743a53ae'
    var pkss = '483045022100afe5d533f9925f987991328b7abbdb5a705113b72488ff6cd5502dcfc2ea1c8b02205cb8a0c686bf13b439b2f4b6e8f69c08ae00df0901a89a4a1313a936b044a43f01';
    var msss = '004830450220582cd0d8c0f42113ef036af9b5b26d500447eb47dd737e129b0d1b9f870166fa022100e6794cc9158cb2347ff440cec6c017ab5043bb71f1cff55baf9df4888902e26a0149304602210089c912fa687304f82634fe4e02f86ad721c3f9b8a6e7a2c06a7b0ba7a891ac18022100ff4f47c88c752a9e2e1ad8d450c7d5c06628159ea2e614f260dcf28c1c7333b101483045022100dd0c15876575df2e9973f3cd57c4f5e9e84d94277d2f4d82cebfb10fe2b25d62022060eb86654f538a5e5c55288de828bdd854e5d1434050a6b54d7d5402b59528ae01';
    var createTestF = function(f) {
      var testF = function(raw, expected) {
        var s = new Script(new Buffer(raw, 'hex'));
        var actual = f.bind(s)();
        if (expected !== null) {
          should.exist(actual);
          actual.should.equal(expected);
        } else {
          should.not.exist(actual);
        }
      };
      return testF;
    };
    describe('#isPubkeyHashScriptSig', function() {
      var isPubkeyHashScriptSig = new Script().isPubkeyHashScriptSig;
      var testPKHSS = createTestF(isPubkeyHashScriptSig);
      it('should identify pubkeyhash scriptsig', function() {
        testPKHSS(pkhss, true);
      });
      it('should not identify pubkey scriptsig', function() {
        testPKHSS(pkss, false);
      });
      it('should not identify p2sh scriptsig', function() {
        testPKHSS(p2shss, false);
      });
      it('should not identify multisig scriptsig', function() {
        testPKHSS(msss, false);
      });
    });
    describe('#isP2shScriptSig', function() {
      var isP2shScriptSig = new Script().isP2shScriptSig;
      var testP2SHSS = createTestF(isP2shScriptSig);
      it('should not identify pubkeyhash scriptsig', function() {
        testP2SHSS(pkhss, false);
      });
      it('should not identify pubkey scriptsig', function() {
        testP2SHSS(pkss, false);
      });
      it('should identify p2sh scriptsig', function() {
        testP2SHSS(p2shss, true);
      });
      it('should not identify multisig scriptsig', function() {
        testP2SHSS(msss, false);
      });
    });
    describe('#isMultiSigScriptSig', function() {
      var isMultiSigScriptSig = new Script().isMultiSigScriptSig;
      var testMSSS = createTestF(isMultiSigScriptSig);
      it('should not identify pubkeyhash scriptsig', function() {
        testMSSS(pkhss, false);
      });
      it('should not identify pubkey scriptsig', function() {
        testMSSS(pkss, false);
      });
      it('should identify p2sh scriptsig', function() {
        testMSSS(p2shss, false);
      });
      it('should not identify multisig scriptsig', function() {
        testMSSS(msss, true);
      });
    });
    describe('#isPubkeyScriptSig', function() {
      var isPubkeyScriptSig = new Script().isPubkeyScriptSig;
      var testPKSS = createTestF(isPubkeyScriptSig);
      it('should not identify pubkeyhash scriptsig', function() {
        testPKSS(pkhss, false);
      });
      it('should not identify pubkey scriptsig', function() {
        testPKSS(pkss, true);
      });
      it('should identify p2sh scriptsig', function() {
        testPKSS(p2shss, false);
      });
      it('should not identify multisig scriptsig', function() {
        testPKSS(msss, false);
      });
    });
    describe('#countSignatures', function() {
      var testCount = createTestF(new Script().countSignatures);
      it('should not identify pubkeyhash scriptsig', function() {
        testCount(pkhss, 1);
      });
      it('should not identify pubkey scriptsig', function() {
        testCount(pkss, 0);
      });
      it('should identify p2sh scriptsig', function() {
        testCount(p2shss, 2);
      });
      it('should not identify multisig scriptsig', function() {
        testCount(msss, 3);
      });
    });
    describe('#getSignatures', function() {
      var testSigs = function(raw, expected) {
        var s = new Script(new Buffer(raw, 'hex'));
        var actual = s.getSignatures();
        actual.length.should.equal(expected.length);
        for (var i = 0; i < actual.length; i++) {
          actual[i].toString('hex').should.equal(expected[i].toString('hex'));
        }
      };
      it('should work with pubkeyhash scriptsig', function() {
        testSigs(pkhss, ['30440220150eccaec1e5d9104434544bf820b1e24c94e0da7a768d62260b57b9f02877db02204d5d193e833099adb0bf38a610d314936fb70671383d2fa6e09586bc77abe3f901']);
      });
      it('should work with pubkey scriptsig', function() {
        testSigs(pkss, []);
      });
      it('should work with p2sh scriptsig', function() {
        testSigs(p2shss, ['30460221008d36f82425396aff3797aed0651954b5bd2bf8768baf358fbeef9994a282d639022100e3967e55972a99b37da210e9a01c580dc3e0e4df8dc9f5a87ba4338c8fc9e5ba01', '304402201aafdf74d2dc5d9d78baadd3beb2e565b0ed14489ad2f1434f9b51ad9b4fa7df02204de4400a1e6817c0883cae056baab77986e65a65aac885020d29d4ddafe3096001']);
      });
      it('should work with multisig scriptsig', function() {
        testSigs(msss, ['30450220582cd0d8c0f42113ef036af9b5b26d500447eb47dd737e129b0d1b9f870166fa022100e6794cc9158cb2347ff440cec6c017ab5043bb71f1cff55baf9df4888902e26a01', '304602210089c912fa687304f82634fe4e02f86ad721c3f9b8a6e7a2c06a7b0ba7a891ac18022100ff4f47c88c752a9e2e1ad8d450c7d5c06628159ea2e614f260dcf28c1c7333b101', '3045022100dd0c15876575df2e9973f3cd57c4f5e9e84d94277d2f4d82cebfb10fe2b25d62022060eb86654f538a5e5c55288de828bdd854e5d1434050a6b54d7d5402b59528ae01']);
      });
    });
    describe('#getHashType', function() {
      var testGHT = createTestF(new Script().getHashType);
      it('should work with undefined sighash (no signatures)', function() {
        var noSigs1 = '010000000189632848f99722915727c5c75da8db2dbf194342a0429828f66ff88fab2af7d60000000000ffffffff0140420f000000000017a914f815b036d9bbbce5e9f2a00abd1bf3dc91e955108700000000';
        var noSigs2 = '0100000001e205297fd05e4504d72761dc7a16e5cc9f4ab89877f28aee97c1cc66b3f07d690100000000ffffffff01706f9800000000001976a91473707e88f79c9c616b44bc766a25efcb9f49346688ac00000000';
        testGHT(noSigs1, null);
        testGHT(noSigs2, null);
      });
      it('should work with SIGHASH_ALL', function() {
        testGHT(pkhss, Transaction.SIGHASH_ALL);
      });
      it('should work with SIGHASH_NONE', function() {
        var none = '004730440220778f3174393e9ee6b0bfa876b4150db6f12a4da9715044ead5e345c2781ceee002203aab31f1e1d3dcf77ca780d9af798139719891917c9a09123dba54483ef462bc02493046022100dd93b64b30580029605dbba09d7fa34194d9ff38fda0c4fa187c52bf7f79ae98022100dd7b056762087b9aa8ccfde328d7067fa1753b78c0ee25577122569ff9de1d57024c695221039f847c24f09d7299c10bba4e41b24dc78e47bbb05fd7c1d209c994899d6881062103d363476e634fc5cdc11e9330c05a141c1e0c7f8b616817bdb83e7579bbf870942103fb2072953ceab87c6da450ac661685a881ddb661002d2ec1d60bfd33e3ec807d53ae';
        testGHT(none, Transaction.SIGHASH_NONE);
      });
      it('should work with SIGHASH_SINGLE', function() {
        var single = '483045022100c9cdd08798a28af9d1baf44a6c77bcc7e279f47dc487c8c899911bc48feaffcc0220503c5c50ae3998a733263c5c0f7061b483e2b56c4c41b456e7d2f5a78a74c077032102d5c25adb51b61339d2b05315791e21bbe80ea470a49db0135720983c905aace0';
        testGHT(single, Transaction.SIGHASH_SINGLE);
      });
    });
  });
});
