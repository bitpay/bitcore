'use strict';
var chai = require('chai'),
  expect = chai.expect,
  sinon = require('sinon');

var PeerSync = require('../../lib/PeerSync.js').class();
describe('PeerSync', function() {
  var ps;

  beforeEach(function(done) {
    ps = new PeerSync();
    ps.init({
      verbose: false
    }, done);
  });
  afterEach(function() {
    ps.close();
  });

  describe('#init()', function() {
    it('should return with no errors', function() {
      var other_ps = new PeerSync();
      expect(other_ps.init.bind(other_ps)).not.to.
      throw (Error);
      other_ps.close();
    });
  });

  describe('#handleInv()', function() {
    var inv_info = {
      message: {
        invs: []
      },
      conn: {
        sendGetData: sinon.spy()
      }
    };
    it('should return with no errors', function() {
      expect(function() {
        ps.handleInv(inv_info);
      }).not.to.
      throw (Error);
    });
    it('should call sendGetData', function() {
      ps.handleInv(inv_info);
      expect(inv_info.conn.sendGetData.calledTwice).to.be.ok;
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
