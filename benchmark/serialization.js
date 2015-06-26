'use strict';

var benchmark = require('benchmark');
var bitcore = require('..');
var bitcoinjs = require('bitcoinjs-lib');
var bcoin = require('bcoin');
var async = require('async');
var fullnode = require('fullnode');
var blockData = require('./block-357238.json');

var maxTime = 20;

console.log('Benchmarking Block/Transaction Serialization');
console.log('---------------------------------------');

async.series([
  function(next) {

    var buffers = [];
    console.log('Generating Random Test Data...');
    for (var i = 0; i < 100; i++) {
      var br = new bitcore.encoding.BufferWriter();
      var num = Math.round(Math.random() * 10000000000000);
      br.writeUInt64LEBN(new bitcore.crypto.BN(num));
      buffers.push(br.toBuffer());
    }

    var c = 0;
    var bn;

    function readUInt64LEBN() {
      if (c >= buffers.length) {
        c = 0;
      }
      var buf = buffers[c];
      var br = new bitcore.encoding.BufferReader(buf);
      bn = br.readUInt64LEBN();
      c++;
    }

    console.log('Starting benchmark...');

    var suite = new benchmark.Suite();
    suite.add('bufferReader.readUInt64LEBN()', readUInt64LEBN, {maxTime: maxTime});
    suite
      .on('cycle', function(event) {
        console.log(String(event.target));
      })
      .on('complete', function() {
        console.log('Done');
        console.log('----------------------------------------------------------------------');
        next();
      })
      .run();
  },
  function(next) {

    var block1;
    var block2;
    var block3;

    function bitcoreTest() {
      block1 = bitcore.Block.fromString(blockData);
    }

    function bitcoinJSTest() {
      block2 = bitcoinjs.Block.fromHex(blockData);
    }

    var parser = new bcoin.protocol.parser();

    function bcoinTest() {
      var raw = bcoin.utils.toArray(blockData, 'hex');
      var data = parser.parseBlock(raw);
      block3 = new bcoin.block(data, 'block');
    }

    var blockDataMessage = '0000000000000000' + blockData; // add mock leading magic and size

    function fullnodeTest() {
      fullnode.Block().fromHex(blockDataMessage);
    }

    var suite = new benchmark.Suite();
    suite.add('bitcore', bitcoreTest, {maxTime: maxTime});
    suite.add('bitcoinjs', bitcoinJSTest, {maxTime: maxTime});
    suite.add('bcoin', bcoinTest, {maxTime: maxTime});
    suite.add('fullnode', fullnodeTest, {maxTime: maxTime});
    suite
      .on('cycle', function(event) {
        console.log(String(event.target));
      })
      .on('complete', function() {
        console.log('Fastest is ' + this.filter('fastest').pluck('name'));
        console.log('----------------------------------------------------------------------');
        next();
      })
      .run();
  }
], function(err) {
  console.log('Finished');
});
