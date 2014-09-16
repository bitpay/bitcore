var should = require('chai').should();
var BN = require('../lib/bn');
var Txout = require('../lib/txout');
var Script = require('../lib/script');
var Varint = require('../lib/varint');
var BufferReader = require('../lib/bufferreader');
var BufferWriter = require('../lib/bufferwriter');

describe('Txout', function() {
  
  it('should make a new txout', function() {
    var txout = new Txout();
    should.exist(txout);
    txout = Txout();
    should.exist(txout);
  });

  var valuebn = BN(5);
  var script = Script().fromString("OP_CHECKMULTISIG");
  var varint = Varint(script.toBuffer().length);
  var txout = new Txout().set({
    valuebn: valuebn,
    varint: varint,
    script: script
  });

  describe('#set', function() {
    
    it('should set this object', function() {
      var txout = new Txout().set({
        valuebn: valuebn,
        varint: varint,
        script: script
      });
      should.exist(txout.valuebn);
      should.exist(txout.varint);
      should.exist(txout.script);
    });

  });

  describe('#fromBuffer', function() {
    
    it('should make this txin from this known buffer', function() {
      var txout = Txout().fromBuffer(new Buffer('050000000000000001ae', 'hex'));
      txout.toBuffer().toString('hex').should.equal('050000000000000001ae');
    });

  });

  describe('#fromBufferReader', function() {
    
    it('should make this txin from this known buffer', function() {
      var txout = Txout().fromBufferReader(BufferReader(new Buffer('050000000000000001ae', 'hex')));
      txout.toBuffer().toString('hex').should.equal('050000000000000001ae');
    });

  });

  describe('#toBuffer', function() {
    
    it('should output this known buffer', function() {
      var txout = Txout().fromBufferReader(BufferReader(new Buffer('050000000000000001ae', 'hex')));
      txout.toBuffer().toString('hex').should.equal('050000000000000001ae');
    });

  });

  describe('#toBufferWriter', function() {
    
    it('should output this known buffer', function() {
      var txout = Txout().fromBufferReader(BufferReader(new Buffer('050000000000000001ae', 'hex')));
      txout.toBufferWriter().concat().toString('hex').should.equal('050000000000000001ae');
    });

  });

});
