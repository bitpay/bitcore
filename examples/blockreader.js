var Block = require('../lib/block');
var BufferReader = require('../lib/bufferreader');
var BufferWriter = require('../lib/bufferwriter');

//This example will parse the blocks in a block file.
//To use, pipe in a blk*****.dat file. e.g.:
//cat blk00000.dat | node blockreader.js

var bw = new BufferWriter();

process.stdin.on('data', function(buf) {
  bw.write(buf);
});

process.stdin.on('end', function(buf) {
  var blocksbuf = bw.concat();
  var br = new BufferReader(blocksbuf);
  while (!br.eof())
    console.log(JSON.stringify(Block().fromBufferReader(br).toJSON(), null, 2));
});
