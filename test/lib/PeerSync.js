'use strict';
var chai = require('chai'),
  expect = chai.expect,
  sinon = require('sinon');

var PeerSync = require('../../lib/PeerSync.js').class();
describe('PeerSync', function() {
  var ps, inv_info;
  beforeEach(function() {
    ps = new PeerSync();
    ps.init();
  });
  afterEach(function(){
    ps.close();
  });
  describe('#init()', function() {
    it('should return with no errors', function() {
      var other_ps = new PeerSync();
      expect(other_ps.init.bind(other_ps)).not.to.throw(Error);
      other_ps.close();
    });
  });
  describe('#handle_inv()', function() {
    inv_info = {
      message: {invs: []},
      conn: {sendGetData: sinon.spy()}
    };
    it('should return with no errors', function(){
      expect(function() {
        ps.handle_inv(inv_info);
      }).not.to.throw(Error);
    });
    it('should call sendGetData', function() {
      ps.handle_inv(inv_info);
      expect(inv_info.conn.calledOnce);
    });
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

