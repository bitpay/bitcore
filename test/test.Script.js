'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

var should = chai.should();

var ScriptModule = bitcore.Script;
var Address = bitcore.Address.class();
var networks = bitcore.networks;
var Script;
var test_data = require('./testdata');

describe('Script', function() {
  it('should initialze the main object', function() {
    should.exist(ScriptModule);
  });
  it('should be able to create class', function() {
    Script = ScriptModule.class();
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
      var scriptHex = '483045022002da7fae9b98615115b7e9a4f1d9efd581463b670f91ec6404a14cb6fc9c4531022100ff449d72ba4e72deb4317267e2d38cec9fd2f58a9afa39c9f5e35f5678694ff50100004c695221033e4cc6b6ee8d8ce3335fed6d4917b2bbbac0f5743b2ced101ba036f95c51e59421023147410ce15e0a31c2bb970cdf01517266dc2c9182f5938636ed363cfd4cc3ae210342a3c8a4b20c7a122a011a07063df04e4c5ad520a1302a2a66e174fd9b0d4ea453ae';
      //decoded: 3045022002da7fae9b98615115b7e9a4f1d9efd581463b670f91ec6404a14cb6fc9c4531022100ff449d72ba4e72deb4317267e2d38cec9fd2f58a9afa39c9f5e35f5678694ff501 0 0 5221033e4cc6b6ee8d8ce3335fed6d4917b2bbbac0f5743b2ced101ba036f95c51e59421023147410ce15e0a31c2bb970cdf01517266dc2c9182f5938636ed363cfd4cc3ae210342a3c8a4b20c7a122a011a07063df04e4c5ad520a1302a2a66e174fd9b0d4ea453ae
      //meaning: sig place_holder place_holder serialized_script
      var scriptBuf = new Buffer(scriptHex, 'hex');
      var script = new Script(scriptBuf);
      script.finishedMultiSig().should.equal(false);
    });
  });

  describe('#removePlaceHolders', function() {
    it('should remove place holders from this script', function() {
      var scriptHex = '483045022002da7fae9b98615115b7e9a4f1d9efd581463b670f91ec6404a14cb6fc9c4531022100ff449d72ba4e72deb4317267e2d38cec9fd2f58a9afa39c9f5e35f5678694ff50100004c695221033e4cc6b6ee8d8ce3335fed6d4917b2bbbac0f5743b2ced101ba036f95c51e59421023147410ce15e0a31c2bb970cdf01517266dc2c9182f5938636ed363cfd4cc3ae210342a3c8a4b20c7a122a011a07063df04e4c5ad520a1302a2a66e174fd9b0d4ea453ae';
      //decoded: 3045022002da7fae9b98615115b7e9a4f1d9efd581463b670f91ec6404a14cb6fc9c4531022100ff449d72ba4e72deb4317267e2d38cec9fd2f58a9afa39c9f5e35f5678694ff501 0 0 5221033e4cc6b6ee8d8ce3335fed6d4917b2bbbac0f5743b2ced101ba036f95c51e59421023147410ce15e0a31c2bb970cdf01517266dc2c9182f5938636ed363cfd4cc3ae210342a3c8a4b20c7a122a011a07063df04e4c5ad520a1302a2a66e174fd9b0d4ea453ae
      //meaning: sig place_holder place_holder serialized_script
      var scriptBuf = new Buffer(scriptHex, 'hex');
      var script = new Script(scriptBuf);
      script.removePlaceHolders();

      var scriptHex2 = '483045022002da7fae9b98615115b7e9a4f1d9efd581463b670f91ec6404a14cb6fc9c4531022100ff449d72ba4e72deb4317267e2d38cec9fd2f58a9afa39c9f5e35f5678694ff5014c695221033e4cc6b6ee8d8ce3335fed6d4917b2bbbac0f5743b2ced101ba036f95c51e59421023147410ce15e0a31c2bb970cdf01517266dc2c9182f5938636ed363cfd4cc3ae210342a3c8a4b20c7a122a011a07063df04e4c5ad520a1302a2a66e174fd9b0d4ea453ae';
      //decoded: 3045022002da7fae9b98615115b7e9a4f1d9efd581463b670f91ec6404a14cb6fc9c4531022100ff449d72ba4e72deb4317267e2d38cec9fd2f58a9afa39c9f5e35f5678694ff501 5221033e4cc6b6ee8d8ce3335fed6d4917b2bbbac0f5743b2ced101ba036f95c51e59421023147410ce15e0a31c2bb970cdf01517266dc2c9182f5938636ed363cfd4cc3ae210342a3c8a4b20c7a122a011a07063df04e4c5ad520a1302a2a66e174fd9b0d4ea453ae
      //meaning: sig serialized_script
      var scriptBuf2 = new Buffer(scriptHex2, 'hex');
      var script2 = new Script(scriptBuf2);

      script.buffer.toString('hex').should.equal(script2.buffer.toString('hex'));
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

  test_data.dataScriptValid.forEach(function(datum) {
    if (datum.length < 2) throw new Error('Invalid test data');
    var human = datum[0] + ' ' + datum[1];
    it('should parse script from human readable ' + human, function() {
      var h2 = Script.fromStringContent(human).getStringContent(false, null);
      Script.fromStringContent(h2).getStringContent(false, null).should.equal(h2);
    });
  });

});
