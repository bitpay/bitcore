'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');

var should = chai.should();

var ScriptModule = bitcore.Script;
var Address = bitcore.Address;
var networks = bitcore.networks;
var Script;
var testdata = testdata || require('./testdata');

describe('Script', function() {
  it('should initialze the main object', function() {
    should.exist(ScriptModule);
  });
  it('should be able to create class', function() {
    Script = ScriptModule;
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
      //console.log('********');
      //console.log(human);
      var script = Script.fromHumanReadable(human);
      //console.log(script);
      var h2 = script.toHumanReadable();
      //console.log(h2);
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
      var pubs = testPubKeysHex.map( function(hex) { 
        return new Buffer(hex,'hex');
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
      var pubs = testPubKeysHex.map( function(hex) {
        return new Buffer(hex,'hex');
      });
      // 3 of 5 multisig, unsorted
      // test case generated with: bitcoind createmultisig 3 '["02c525d65d18be8fb36ab50a21bee02ac9fdc2c176fa18791ac664ea4b95572ae0", "02b937d54b550a3afdc2819772822d25869495f9e588b56a0205617d80514f0758", "0266dd7664e65958f3cc67bf92ad6243bc495df5ab56691719263977104b635bea","02ee91377073b04d1d9d19597b81a7be3db6554bd7d16151cb5599a6107a589e70", "02c8f63ad4822ef360b5c300f08488fa0fa24af2b2bebb6d6b602ca938ee5af793"]'
      var s1 = Script.createMultisig(3,pubs, {noSorting: true});
      s1.getBuffer().toString('hex').should.equal('532102c525d65d18be8fb36ab50a21bee02ac9fdc2c176fa18791ac664ea4b95572ae02102b937d54b550a3afdc2819772822d25869495f9e588b56a0205617d80514f0758210266dd7664e65958f3cc67bf92ad6243bc495df5ab56691719263977104b635bea2102ee91377073b04d1d9d19597b81a7be3db6554bd7d16151cb5599a6107a589e702102c8f63ad4822ef360b5c300f08488fa0fa24af2b2bebb6d6b602ca938ee5af79355ae');

      // 3 of 5 multisig, sorted
      // test case generated with: bitcoind createmultisig 3 '["0266dd7664e65958f3cc67bf92ad6243bc495df5ab56691719263977104b635bea", "02b937d54b550a3afdc2819772822d25869495f9e588b56a0205617d80514f0758", "02c525d65d18be8fb36ab50a21bee02ac9fdc2c176fa18791ac664ea4b95572ae0", "02c8f63ad4822ef360b5c300f08488fa0fa24af2b2bebb6d6b602ca938ee5af793", "02ee91377073b04d1d9d19597b81a7be3db6554bd7d16151cb5599a6107a589e70"]'
      var s2 = Script.createMultisig(3,pubs);
      s2.getBuffer().toString('hex').should.equal('53210266dd7664e65958f3cc67bf92ad6243bc495df5ab56691719263977104b635bea2102b937d54b550a3afdc2819772822d25869495f9e588b56a0205617d80514f07582102c525d65d18be8fb36ab50a21bee02ac9fdc2c176fa18791ac664ea4b95572ae02102c8f63ad4822ef360b5c300f08488fa0fa24af2b2bebb6d6b602ca938ee5af7932102ee91377073b04d1d9d19597b81a7be3db6554bd7d16151cb5599a6107a589e7055ae');

    });
  });


  describe('#countMissingSignatures', function() {
    Script = ScriptModule;
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
      var pubs = testPubKeysHex.map( function(hex) {
        return new Buffer(hex,'hex');
      });
      var s1 = Script.createMultisig(3,pubs, {noSorting: true});
      s1.isMultiSig().should.equal(true);
    });
    it('should return false for invalid multisig scripts', function() {
      (new Script(new Buffer('000000ae','hex'))).isMultiSig().should.equal(false);
      var s = new Script(new Buffer('522103bb52138972c48a132fc1f637858c5189607dd0f7fe40c4f20f6ad65f2d389ba42103bb52138972c48a132fc1f637858c5189607dd0f7fe40c4f20f6ad65f2d389ba45f6054ae','hex'));

      (new Script(new Buffer('522103bb52138972c48a132fc1f637858c5189607dd0f7fe40c4f20f6ad65f2d389ba42103bb52138972c48a132fc1f637858c5189607dd0f7fe40c4f20f6ad65f2d389ba45f6054ae','hex'))).isMultiSig().should.equal(false);
      
    });
  });

});
