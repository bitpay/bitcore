'use strict';

var benchmark = require('benchmark');
var bitcore = require('..');
var async = require('async');
var blockData = require('./block-357238.json');

var maxTime = 10;

console.log('Benchmarking Script');
console.log('---------------------------------------');

async.series([
  function(next) {

    var c = 0;
    var scripts = [];
    var inputScripts = [];
    var outputScripts = [];
    var block = bitcore.Block.fromString(blockData);
    for (var i = 0; i < block.transactions.length; i++) {
      var tx = block.transactions[i];
      for (var j = 0; j < tx.inputs.length; j++) {
        var input = tx.inputs[j];
        if (input.script) {
          scripts.push(input.script);
          inputScripts.push(input.script);
        }
      }
      for (var k = 0; k < tx.outputs.length; k++) {
        var output = tx.outputs[k];
        if (output.script) {
          scripts.push(output.script);
          outputScripts.push(output.script);
        }
      }
    }

    function isPublicKeyHashIn() {
      if (c >= scripts.length) {
        c = 0;
      }
      scripts[c].isPublicKeyHashIn();
      c++;
    }

    function toAddress() {
      if (c >= scripts.length) {
        c = 0;
      }
      scripts[c].toAddress();
      c++;
    }

    function toOutputAddress() {
      if (c >= outputScripts.length) {
        c = 0;
      }
      outputScripts[c].toOutputAddress();
      c++;
    }

    function toInputAddress() {
      if (c >= inputScripts.length) {
        c = 0;
      }
      inputScripts[c].toInputAddress();
      c++;
    }

    function getAddressInfo() {
      if (c >= scripts.length) {
        c = 0;
      }
      scripts[c].getAddressInfo();
      c++;
    }

    var suite = new benchmark.Suite();
    suite.add('isPublicKeyHashIn', isPublicKeyHashIn, {maxTime: maxTime});
    suite.add('toAddress', toAddress, {maxTime: maxTime});
    suite.add('toInputAddress', toInputAddress, {maxTime: maxTime});
    suite.add('toOutputAddress', toOutputAddress, {maxTime: maxTime});
    suite.add('getAddressInfo', getAddressInfo, {maxTime: maxTime});
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
  }
], function(err) {
  console.log('Finished');
});
