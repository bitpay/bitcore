var Varint = require('../lib/varint');
var Transaction = require('../lib/transaction');
var Txin = require('../lib/txin');
var Txout = require('../lib/txout');
var should = require('chai').should();
var BufferReader = require('../lib/bufferreader');
var BufferWriter = require('../lib/bufferwriter');

describe('Transaction', function() {

  it('should make a new transaction', function() {
    var tx = new Transaction();
    should.exist(tx);
    tx = Transaction();
    should.exist(tx);
  });

  var txin = Txin().fromBuffer(new Buffer('00000000000000000000000000000000000000000000000000000000000000000000000001ae00000000', 'hex'));
  var txout = Txout().fromBuffer(new Buffer('050000000000000001ae', 'hex'));
  var tx = Transaction().set({
    version: 0,
    txinsvarint: Varint(1),
    txins: [txin],
    txoutsvarint: Varint(1),
    txouts: [txout],
    nlocktime: 0
  });
  var txhex = '000000000100000000000000000000000000000000000000000000000000000000000000000000000001ae0000000001050000000000000001ae00000000';
  var txbuf = new Buffer(txhex, 'hex');

  describe('#set', function() {

    it('should set all the basic parameters', function() {
      var tx = Transaction().set({
        version: 0,
        txinsvarint: Varint(1),
        txins: [txin],
        txoutsvarint: Varint(1),
        txouts: [txout],
        nlocktime: 0
      });
      should.exist(tx.version);
      should.exist(tx.txinsvarint);
      should.exist(tx.txins);
      should.exist(tx.txoutsvarint);
      should.exist(tx.txouts);
      should.exist(tx.nlocktime);
    });

  });

  describe('#fromBuffer', function() {
    
    it('should recover from this known tx', function() {
      Transaction().fromBuffer(txbuf).toBuffer().toString('hex').should.equal(txhex);
    });

  });

  describe('#fromBufferReader', function() {
    
    it('should recover from this known tx', function() {
      Transaction().fromBufferReader(BufferReader(txbuf)).toBuffer().toString('hex').should.equal(txhex);
    });

  });

  describe('#toBuffer', function() {
    
    it('should produce this known tx', function() {
      Transaction().fromBuffer(txbuf).toBuffer().toString('hex').should.equal(txhex);
    });

  });

  describe('#toBufferWriter', function() {
    
    it('should produce this known tx', function() {
      Transaction().fromBuffer(txbuf).toBufferWriter().concat().toString('hex').should.equal(txhex);
    });

  });

});
