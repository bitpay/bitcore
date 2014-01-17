'use strict';
var chai = require('chai'),
  expect = chai.expect,
  sinon = require('sinon');

var PeerSync = require('../../lib/PeerSync.js').class();
describe('PeerSync', function() {
  var ps;

  beforeEach(function() {
    ps = new PeerSync();
    ps.init({verbose: false});
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
      expect(inv_info.conn.sendGetData.calledTwice).to.be.ok;
    });
  });

  describe('#handle_tx()', function() {
    var tx_info = {
      message: { tx: {getStandardizedObject: function(){
        return {hash: 'dac28b5c5e70c16942718f3a22438348c1b709e01d398795fce8fc455178b973'};}}}
    };
    it('should call storeTxs', function(){
      var spy = sinon.spy(ps.sync, 'storeTxs');
      ps.handle_tx(tx_info);
      expect(spy.calledOnce).to.be.ok;
    });
  });

  describe('#handle_block()', function() {
    var block_info = {
      message: { block: {calcHash: function(){
        return new Buffer('01234');
      }, txs: [{hash: new Buffer('cabafeca')}, {hash: new Buffer('bacacafe')}]}}
    };
    it('should call storeBlock', function(){
      var spy = sinon.spy(ps.sync, 'storeBlock');
      ps.handle_block(block_info);
      expect(spy.calledOnce).to.be.ok;
    });
  });

  describe('#run()', function() {
    it('should setup peerman', function() {
      var startSpy = sinon.spy(ps.peerman, 'start');
      var onSpy = sinon.spy(ps.peerman, 'on');
      ps.run();
      
      expect(startSpy.called).to.be.ok;
      expect(onSpy.called).to.be.ok;
    });
  });
});

