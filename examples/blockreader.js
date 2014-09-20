var Block = require('../lib/block');
var BufferReader = require('../lib/bufferreader');
var BufferWriter = require('../lib/bufferwriter');

//This example will parse the blocks in a block file.
//To use, pipe in a blk*****.dat file. e.g.:
//cat blk00000.dat | node blockreader.js

var head = null;

process.stdin.on('readable', function() {
  if (!head) {
    head = process.stdin.read(8);
    if (!head)
      return;
  }
  var body = process.stdin.read(head.slice(4).readUInt32LE(0));
  if (!body)
    return;
  var blockbuf = BufferWriter().write(head).write(body).concat();
  var block = Block().fromBuffer(blockbuf);
  console.log(block.toJSON());
  head = null;
  process.stdin.unshift(process.stdin.read());
});
