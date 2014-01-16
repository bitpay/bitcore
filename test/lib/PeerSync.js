'use strict';
var chai = require('chai'),
  expect = chai.expect,
  sinon = require('sinon');

var PeerSync = require('../../lib/PeerSync.js').class();
describe('PeerSync', function() {
  var ps;

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
    var inv_info = {
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
      expect(inv_info.conn.sendGetData.calledOnce).to.be.ok;
    });
  });

  describe('#handle_tx()', function() {
    var tx_info = {
      message: { tx: {getStandardizedObject: function(){
        return {hash: '00000000e3fe5b3b5416374d8d65560a0792a6da71546d67b00c9d37e8a4cf59'};}}}
    };
    it('should call storeTxs', function(){
      var spy = sinon.spy(ps.sync, 'storeTxs');
      ps.handle_tx(tx_info);
      expect(spy.calledOnce);
    });
  });

  describe('#handle_block()', function() {
    it('should call storeBlock');
    it('should call storeTxs for each transaction');
  });

  describe('#run()', function() {
    it('should setup peerman');
  });
});

