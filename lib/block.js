var Transaction = require('./transaction');
var BufferReader = require('./bufferreader');
var BufferWriter = require('./bufferwriter');
var Blockheader = require('./blockheader');
var Varint = require('./varint');

var Block = function Block(magicnum, blocksize, blockheader, txsvarint, txs) {
  if (!(this instanceof Block))
    return new Block(magicnum, blocksize, blockheader, txsvarint, txs);
  if (typeof magicnum === 'number') {
    this.set({
      magicnum: magicnum,
      blocksize: blocksize,
      blockheader: blockheader,
      txsvarint: txsvarint,
      txs: txs
    });
  } else if (magicnum) {
    var obj = magicnum;
  }
};

Block.prototype.set = function(obj) {
  this.magicnum = typeof obj.magicnum !== 'undefined' ? obj.magicnum : this.magicnum;
  this.blocksize = typeof obj.blocksize !== 'undefined' ? obj.blocksize : this.blocksize;
  this.blockheader = obj.blockheader || this.blockheader;
  this.txsvarint = obj.txsvarint || this.txsvarint;
  this.txs = obj.txs || this.txs;
  return this;
};

Block.prototype.fromBuffer = function(buf) {
  return this.fromBufferReader(BufferReader(buf));
};

Block.prototype.fromBufferReader = function(br) {
  this.magicnum = br.readUInt32LE();
  this.blocksize = br.readUInt32LE();
  this.blockheader = Blockheader().fromBufferReader(br);
  this.txsvarint = Varint(br.readVarintBuf());
  var txslen = this.txsvarint.toNumber();
  this.txs = [];
  for (var i = 0; i < txslen; i++) {
    this.txs.push(Transaction().fromBufferReader(br));
  }
  return this;
};

Block.prototype.toBuffer = function() {
  return this.toBufferWriter().concat();
};

Block.prototype.toBufferWriter = function(bw) {
  if (!bw)
    bw = new BufferWriter();
  bw.writeUInt32LE(this.magicnum);
  bw.writeUInt32LE(this.blocksize);
  bw.write(this.blockheader.toBuffer());
  bw.write(this.txsvarint.buf);
  var txslen = this.txsvarint.toNumber();
  for (var i = 0; i < txslen; i++) {
    this.txs[i].toBufferWriter(bw);
  }
  return bw;
};

module.exports = Block;
