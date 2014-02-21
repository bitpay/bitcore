var assert = require('assert');
var Script = require('../Script').class();
var networks = require('../networks');
var Put = require('bufferput');
var hex = function(hex) {return new Buffer(hex, 'hex');};

describe('Script', function(){
  describe('#finishedMultiSig', function(){
    it('should report that this scriptSig has finished being signed', function() {
      var scriptHex = '00493046022100954d2aa7af9a2de34b04e4151842933df81acc379580cd0c057883cfb0994a8b022100de1530692eda9cdb567c94e05fc856cfbc26fcf3482148bde85f143032f4902501483045022100d164d174118497d93e0062b573be78d4b9417aee09889cd242a966af73367917022054f095be0bce9edee556a2216239fcad45a7a64d8fb318dc5375c9159724689a014c695221033e4cc6b6ee8d8ce3335fed6d4917b2bbbac0f5743b2ced101ba036f95c51e59421023147410ce15e0a31c2bb970cdf01517266dc2c9182f5938636ed363cfd4cc3ae210342a3c8a4b20c7a122a011a07063df04e4c5ad520a1302a2a66e174fd9b0d4ea453ae';
      //decoded: 0 3046022100954d2aa7af9a2de34b04e4151842933df81acc379580cd0c057883cfb0994a8b022100de1530692eda9cdb567c94e05fc856cfbc26fcf3482148bde85f143032f4902501 3045022100d164d174118497d93e0062b573be78d4b9417aee09889cd242a966af73367917022054f095be0bce9edee556a2216239fcad45a7a64d8fb318dc5375c9159724689a01 5221033e4cc6b6ee8d8ce3335fed6d4917b2bbbac0f5743b2ced101ba036f95c51e59421023147410ce15e0a31c2bb970cdf01517266dc2c9182f5938636ed363cfd4cc3ae210342a3c8a4b20c7a122a011a07063df04e4c5ad520a1302a2a66e174fd9b0d4ea453ae
      //meaning: OP_0 sig sig serialized_script
      var scriptBuf = new Buffer(scriptHex, 'hex');
      var script = new Script(scriptBuf);
      assert.equal(script.finishedMultiSig(), true);
    });
    it('should report that this scripSig has not finished being signed', function() {
      var scriptHex = '483045022002da7fae9b98615115b7e9a4f1d9efd581463b670f91ec6404a14cb6fc9c4531022100ff449d72ba4e72deb4317267e2d38cec9fd2f58a9afa39c9f5e35f5678694ff50100004c695221033e4cc6b6ee8d8ce3335fed6d4917b2bbbac0f5743b2ced101ba036f95c51e59421023147410ce15e0a31c2bb970cdf01517266dc2c9182f5938636ed363cfd4cc3ae210342a3c8a4b20c7a122a011a07063df04e4c5ad520a1302a2a66e174fd9b0d4ea453ae';
      //decoded: 3045022002da7fae9b98615115b7e9a4f1d9efd581463b670f91ec6404a14cb6fc9c4531022100ff449d72ba4e72deb4317267e2d38cec9fd2f58a9afa39c9f5e35f5678694ff501 0 0 5221033e4cc6b6ee8d8ce3335fed6d4917b2bbbac0f5743b2ced101ba036f95c51e59421023147410ce15e0a31c2bb970cdf01517266dc2c9182f5938636ed363cfd4cc3ae210342a3c8a4b20c7a122a011a07063df04e4c5ad520a1302a2a66e174fd9b0d4ea453ae
      //meaning: sig place_holder place_holder serialized_script
      var scriptBuf = new Buffer(scriptHex, 'hex');
      var script = new Script(scriptBuf);
      assert.equal(script.finishedMultiSig(), false);
    });
  });

  describe('#removePlaceHolders', function(){
    it('should remove place holders from this script', function(){
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

      assert.equal(script.buffer.toString('hex'), script2.buffer.toString('hex'));
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
      assert.equal(script.chunks[0], 0);
    });
  });


  describe('getAddrStr', function() {
    it('unknown tx', function() {
        var scriptHex = '04';
        var scriptBuf = new Buffer(scriptHex, 'hex');
        var script = new Script(scriptBuf);
        assert.equal(script.getAddrStrs()[0], undefined);
    });

    it('should get address from p2pubkey tx', function() {
      var b = new Put()
        .word8(65) // 65 bytes of data follow
        .put(hex('04678AFDB0FE5548271967F1A67130B7105CD6A828E03909A67962E0EA1F61DEB649F6BC3F4CEF38C4F35504E51EC112DE5C384DF7BA0B8D578A4C702B6BF11D5F'))
        .word8(0xAC) // OP_CHECKSIG
        .buffer()
        ;

      var script = new Script(b);
      assert.equal(script.getAddrStrs(networks.testnet)[0], 'mpXwg4jMtRhuSpVq4xS3HFHmCmWp9NyGKt');
      assert.equal(script.getOneAddrStr(networks.testnet), 'mpXwg4jMtRhuSpVq4xS3HFHmCmWp9NyGKt');
    });

    it('should get address from p2pubkeyhash tx', function() {

      //TESTNET TX: a6ca7a5152593c847154a5958c0e1cefee73dd8d72754b41f0af7e6fb876d924
      var b = new Put()
        .word8(0x76) // OP_DUP
        .word8(0xa9) // OP_HASH160
        .word8(0x14)
        .put(hex('ff2620a73ef0a1cf357507a045e5bc138c806878'))
        .word8(0x88) // OP_EQUALVERIFY
        .word8(0xAC) // OP_CHECKSIG
        .buffer();

      var script = new Script(b);
      assert.equal(script.getOneAddrStr(networks.testnet), 'n4n4H7tMhgakTLvjRyFPYE4LR1mSdiKYRJ');
    });


    it('should get address from p2sh tx', function() {

      //TESTNET TX: cfe627060cf6ea8d8950a0a792f7617e7ac0a5028e659473763147fb82db4576 
      var b = new Put()
        .word8(0xa9) // OP_HASH160
        .word8(20)
        .put(hex('4de60f7aeb6d5d2ed5e1cd0ccbf28e739b2dc420'))
        .word8(0x87) // OP_EQUALVERIFY
        .buffer();

      var script = new Script(b);
      assert.equal(script.getOneAddrStr(networks.testnet), '2MzM7cwGmhEATvM3FVJ53M7A4uTkXSQD6ur');
    });
    it('should get addresses from multisig  tx', function() {

      var script = Script.createMultisig(2, [
        hex('04678AFDB0FE5548271967F1A67130B7105CD6A828E03909A67962E0EA1F61DEB649F6BC3F4CEF38C4F35504E51EC112DE5C384DF7BA0B8D578A4C702B6BF11D5F'),
        hex('021aeaf2f8638a129a3156fbe7e5ef635226b0bafd495ff03afe2c843d7e3a4b51'),
        hex('038a7f6ef1c8ca0c588aa53fa860128077c9e6c11e6830f4d7ee4e763a56b7718f')
      ]
      );
      assert.equal(script.getAddrStrs(networks.testnet)[0], 'mpXwg4jMtRhuSpVq4xS3HFHmCmWp9NyGKt');

      assert.equal(script.getAddrStrs(networks.testnet)[1], 'n3GNqMveyvaPvUbH469vDRadqpJMPc84JA');
      assert.equal(script.getAddrStrs(networks.testnet)[2], 'msf4WtN1YQKXvNtvdFYt9JBnUD2FB41kjr');
    });
  });
});
