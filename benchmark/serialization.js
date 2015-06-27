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

    var block1;
    var block2;
    var block3;
    var block4;

    function bitcoreTest() {
      block1 = bitcore.Block.fromString(blockData);
    }

    function bitcoreRawTest() {
      block2 = new bitcore.RawBlock(new bitcore.encoding.BufferReader(new Buffer(blockData, 'hex')));
    }

    function bitcoinJSTest() {
      block3 = bitcoinjs.Block.fromHex(blockData);
    }

    var parser = new bcoin.protocol.parser();

    function bcoinTest() {
      var raw = bcoin.utils.toArray(blockData, 'hex');
      var data = parser.parseBlock(raw);
      block4 = new bcoin.block(data, 'block');
    }

    var blockDataMessage = '0000000000000000' + blockData; // add mock leading magic and size

    function fullnodeTest() {
      fullnode.Block().fromHex(blockDataMessage);
    }

    var suite = new benchmark.Suite();
    suite.add('bitcore.Block', bitcoreTest, {maxTime: maxTime});
    suite.add('bitcore.RawBlock', bitcoreRawTest, {maxTime: maxTime});
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
