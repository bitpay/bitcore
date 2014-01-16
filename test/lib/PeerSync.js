'use strict';
var assert = require('assert');
var PeerSync = require('../../lib/PeerSync.js').class();
describe('Unit testing PeerSync', function() {
  var ps;
  beforeEach(function() {
    ps = new PeerSync();
  });
  describe('#init()', function() {
    it('should return with no errors', function() {
      assert.doesNotThrow(function() {
        ps.init();
      });
    });
  });
  describe('#handle_inv()', function() {
    it('should return with no errors');
    it('should call sendGetData');
  });
  describe('#handle_tx()', function() {
    it('should call storeTxs');
  });
  describe('#handle_block()', function() {
    it('should call storeBlock');
    it('should call storeTxs for each transaction');
  });
  describe('#run()', function() {
    it('should setup peerman');
  });
});

