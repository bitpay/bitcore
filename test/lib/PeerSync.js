'use strict';
var assert = require('assert');
var PeerSync = require('../../lib/PeerSync.js').class();
describe('Unit testing PeerSync', function() {
  var ps = new PeerSync();
  describe('#init()', function() {
    it('should return with no errors', function() {
      assert.doesNotThrow(function(){
        ps.init();
      });
    });
  });
});

