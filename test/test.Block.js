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

    var coinbase = b.txs.shift;
    b.checkTransactions.bind(b.txs).should.throw();
    b.txs.push(coinbase);
    b.checkTransactions.bind(b.txs).should.throw();


  });

  it('should be able to checkMerkleRoot', function() {

    var b = getBlock();
    b.getMerkleTree(b.txs).length.should.equal(45);
    bitcore.buffertools.toHex(b.calcMerkleRoot(b.txs)).should.equal(bitcore.buffertools.toHex(new Buffer(b.merkle_root)));

    b.checkMerkleRoot(b.txs);

    delete b['merkle_root'];
    b.checkMerkleRoot.bind(b.txs).should.throw();


    b.merkle_root=new Buffer('wrong');
    b.checkMerkleRoot.bind(b.txs).should.throw();
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


  it('should be able to check via checkBlock', function() {
    var b = getBlock();
    b.checkBlock.bind(b.txs).should.throw();
    b.getHash();
    b.checkBlock(b.txs).should.equal(true);
  });

  it('should be able to get components from blocks', function() {
    var b = getBlock(true);

    bitcore.util.formatHashFull(b.getHash()).should.equal('000000000b99b16390660d79fcc138d2ad0c89a0d044c4201a02bdf1f61ffa11');

    bitcore.util.formatHashFull(b.getHeader()).should.equal('d6383bd51c3fffc051be10ce58e6d52d1eb00470ae1ab4d5a3375c0f51382c6f249fff84e9888286974cfc97000000003c35b5e70b13d5b938fef4e998a977c17bea978390273b7c50a9aa4b00000002');

    bitcore.util.formatHashFull(b.merkle_root).should.equal('58e6d52d1eb00470ae1ab4d5a3375c0f51382c6f249fff84e9888286974cfc97');

  });


  it('#getBlockValue should return the correct block value', function() {
    var c = bitcore.util.COIN;
    bitcore.Block.getBlockValue(0).div(c).toNumber().should.equal(50);
    bitcore.Block.getBlockValue(1).div(c).toNumber().should.equal(50);
    bitcore.Block.getBlockValue(209999).div(c).toNumber().should.equal(50);
    bitcore.Block.getBlockValue(210000).div(c).toNumber().should.equal(25);
    bitcore.Block.getBlockValue(2100000).toNumber().should.equal(4882812);
  });


  it('#getStandardizedObject should return object', function() {
    var b = getBlock();
    var o = b.getStandardizedObject(b.txs);

    o.hash.should.equal('000000000b99b16390660d79fcc138d2ad0c89a0d044c4201a02bdf1f61ffa11');
    o.n_tx.should.equal(22);
    o.size.should.equal(8003);
    var o2 = b.getStandardizedObject();
    o2.hash.should.equal('000000000b99b16390660d79fcc138d2ad0c89a0d044c4201a02bdf1f61ffa11');
    o2.size.should.equal(0);
  });


  it('#miner should call the callback', function(done) {
    var b = getBlock();
    var Miner =  function() {};
    Miner.prototype.solve = function (header,target,cb) {
      this.called=1;
      should.exist(header);
      should.exist(target);
      return cb();
    };
    var miner = new Miner();
    b.solve(miner, function () {
      miner.called.should.equal(1);
      done();
    });

  });

  it('#createCoinbaseTx should create a tx', function() {
    var b = new Block();
    var pubkey = new Buffer('02d20b3fba521dcf88dfaf0eee8c15a8ba692d7eb0cb957d5bcf9f4cc052fb9cc6');
    var tx = b.createCoinbaseTx(pubkey);
    should.exist(tx);
    tx.isCoinBase().should.equal(true);
  });

  it('should parse a normal auxpow block', function() {
    var blockHex = '02016200825982315ff62d7c8e9b92b422a248684b4802ffd1e8455f575ab26278a95c54e72b551f32d408374955222c40d93d2d562ab2aa871189022ddbd29f47789be85b9c13545580061b0000000001000000010000000000000000000000000000000000000000000000000000000000000000ffffffff560351c209062f503253482f04939c135408fabe6d6de5a1186907db2a3b9bec5ef4c759ea2d2775978257eb4c46384dd9fe482c848d0100000000000000000072c8b90f0000102f434d7366697265313135323333302f000000000160a0102a010000001976a91411fde3131d4a59d9de9d6d9390f8baeebf50396088ac000000004ce5f80b8dbc51182ae358aa68424d38dc2c58f46e2dd436bf1743214efb45b904fa9f6461984815a49339fa6bfb52f20f87fd71049a0f04b88312b26636fb0d5dfa5755d53f3e3e39f92146886687e34375ec4a9bbcc9be04186abb6693e8133c0c4fb26a8be10916e2581b92b379d123cd84bee34a223ca3cf62b524ce7a44b20cd59c3f6cef74ecad00a49ac247b395d25ff31a869e5e81083298eb37db9fe7000000000000000000020000005b603fc2e0bb311cc0b5727d4231b2308d6a38f28ef2dc47257ece29cfedc164d836ab7f4179a55c9eb49e61d3b02abecdb59227026cc9de0d2d1a9b9e74f9ee939c13545a50021b8a6be0390301000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0d0358b1050101062f503253482fffffffff010085fd36af0500002321025cc09c00d9ec99c4499ff7a676c00763392a5f68a76f52693a3fe61ec2eaf432ac0000000001000000014e5cc18a6a0b0c04968c02696d7100df68e834822a6f93d41531ee563cb52ae0010000006c493046022100bfa4e3884402e6f60ed794e12432f79de88efce6102bb0dcbaca114b6d593bf1022100c1114fc5fdd94741d39cb1e6bd43afcbb09d7ea3d8d1a27bc8db45b8a1f3ae550121033fcc1cb9c1b7b11758eb2cd3a25b4ff917a5e248f5d6fcc74160dd6a450acf8bffffffff02008a73e3000000001976a914b9ce787cfe070e17e9f3c9a2050974eadcf0fbf288aca04b35e37b0100001976a914a1ea13863020f36897b671ad328d98e9364f12b488ac00000000010000000150c61fc7c91ba58e7856fa3fb180c00b68fcb57399c50a812c71693b55171a9b000000006a473044022049b99d51affac2b89f55789d8ff22269a9fa9c99fb9803978e04f6c45f6bd9210220689eae4cf37e86e5b7b89dae53628bf3a81e2812ed36197c82031248f84b1d350121032997ce4dab1fdddae5ff4a3017907f5c6c3a82204ba86e2f9f701e4959ade67bffffffff01c0aa0c23010000001976a91481db1aa49ebc6a71cad96949eb28e22af85eb0bd88ac00000000';
    var parser = new BinaryParser(new Buffer(blockHex, 'hex'));
    var b = new bitcore.Block();
    b.parse(parser);
    var blockHash = b.calcHash().toString('hex');
    blockHash.should.equal('8d842c48fed94d38464ceb57829775272dea59c7f45eec9b3b2adb076918a1e5');
    var auxPow = b.auxPow;
    auxPow.coinbaseTx.version.should.equal(1);
  });
});





