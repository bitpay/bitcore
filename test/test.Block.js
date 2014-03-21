'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var should = chai.should();

var testdata = testdata || require('./testdata');
var BlockModule = bitcore.Block;
var BinaryParser = bitcore.BinaryParser;
var Block;


var getBlock = function (onlyHeader) {

  var testnetMagic = bitcore.networks.testnet.magic.toString('hex');

  var b = new Block();
  // this is block 86756 from testnet3
  var p = new BinaryParser(testdata.dataRawBlock);


  var magic = p.buffer(4).toString('hex');


  if (magic !== testnetMagic )
    throw new Error('CRITICAL ERROR: Magic number mismatch: ' +
                    magic + ' : ' + testnetMagic);

  p.word32le();
  b.parse(p, onlyHeader);
  return b;
};

describe('Block', function() {
  it('should initialze the main object', function() {
    should.exist(BlockModule);
  });
  it('should be able to create class', function() {
    Block = BlockModule;
    should.exist(Block);
  });
  it('should be able to create instance', function() {
    var b = new Block();
    should.exist(b);
  });

  it('should be able to parse a block from hex', function() {
    var b = getBlock();
    should.exist(b);
    should.exist(b.getHash());
  });

  it('should be able to check block contents', function() {
    var b = getBlock();
    should.exist(b.getHash());
    b.checkHash().should.equal(true);
    b.checkProofOfWork().should.equal(true);
    b.checkProofOfWork().should.equal(true);
    b.getWork().toString().should.equal('17180131332');
    b.checkTimestamp().should.equal(true);

  });
  it('#checkBlock should be able to check block contents', function() {
    var b = getBlock();
    should.exist(b.getHash());
    b.checkBlock().should.equal(true);
  });


  it('should be able to check Transactions', function() {
    var b = getBlock();

    b.checkTransactions(b.txs).should.equal(true);
    b.checkTransactions.bind([]).should.throw();

    b.getMerkleTree(b.txs).length.should.equal(45);
    bitcore.buffertools.toHex(b.calcMerkleRoot(b.txs)).should.equal(bitcore.buffertools.toHex(b.merkle_root));

    var coinbase = b.txs.shift;
    b.checkTransactions.bind(b.txs).should.throw();

    b.txs.push(coinbase);

    b.checkTransactions.bind(b.txs).should.throw();

  });
 
  it('should be able to checkProofOfWork', function() {
    var b = getBlock();

    b.hash = bitcore.buffertools.reverse(new Buffer('000000000b99b16390660d79fcc138d2ad0c89a0d044c4201a02bdf1f61ffa11', 'hex'));
    b.checkHash().should.equal(true);
    b.checkProofOfWork().should.equal(true);

    // wrong hash hash, ok proof of work
    b.hash = bitcore.buffertools.reverse(new Buffer('000000000000016390660d79fcc138d2ad0c89a0d044c4201a02bdf1f61ffa11', 'hex'));
    b.checkProofOfWork().should.equal(true);
    b.checkHash().should.equal(false);


    // wrong hash hash, wrong proof of work
    b.hash = bitcore.buffertools.reverse(new Buffer('0000000bbb99b16390660d79fcc138d2ad0c89a0d044c4201a02bdf1f61ffa11', 'hex'));
    b.checkHash().should.equal(false);
    b.checkProofOfWork.bind().should.throw();
  });

  it('should be able to get components from blocks', function() {
    var b = getBlock(true);

    bitcore.util.formatHashFull(b.getHash()).should.equal('000000000b99b16390660d79fcc138d2ad0c89a0d044c4201a02bdf1f61ffa11');

    bitcore.util.formatHashFull(b.getHeader()).should.equal('d6383bd51c3fffc051be10ce58e6d52d1eb00470ae1ab4d5a3375c0f51382c6f249fff84e9888286974cfc97000000003c35b5e70b13d5b938fef4e998a977c17bea978390273b7c50a9aa4b00000002');

    bitcore.util.formatHashFull(b.merkle_root).should.equal('58e6d52d1eb00470ae1ab4d5a3375c0f51382c6f249fff84e9888286974cfc97');

  });


});





