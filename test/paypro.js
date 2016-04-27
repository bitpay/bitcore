'use strict';

var _ = require('lodash');
var chai = chai || require('chai');
var sinon = sinon || require('sinon');
var should = chai.should();
var PayPro = require('../lib/paypro');
var TestData = require('./testdata');


describe('paypro', function() {
  var xhr, httpNode, clock;
  before(function() {
    // Stub time before cert expiration at Mar 27 2016
    clock = sinon.useFakeTimers(1459105693843);

    xhr = {};
    xhr.onCreate = function(req) {};
    xhr.open = function(method, url) {};
    xhr.setRequestHeader = function(k, v) {};
    xhr.getAllResponseHeaders = function() {
      return 'content-type: test';
    };
    xhr.send = function() {
      xhr.response = TestData.payProBuf;
      xhr.onload();
    };

    httpNode = {};
    httpNode.get = function(opts, cb) {
      var res = {};
      res.statusCode = httpNode.error || 200;
      res.on = function(e, cb) {
        if (e == 'data')
          return cb(TestData.payProBuf);
        if (e == 'end')
          return cb();
      };
      return cb(res);
    };
    httpNode.post = function(opts, cb) {
      var res = {};
      res.statusCode = httpNode.error || 200;
      res.on = function(e, cb) {
        if (e == 'data')
          return cb(new Buffer('id'));
        if (e == 'end')
          return cb();
      };

      return cb(res);
    };
  });
  after(function() {
    clock.restore();
  });

  it('Make a PP request with browser', function(done) {
    PayPro.get({
      url: 'http://an.url.com/paypro',
      xhr: xhr,
      env: 'browser',
    }, function(err, res) {
      should.not.exist(err);
      res.should.deep.equal(TestData.payProData);
      done();
    });
  });

  it('Make a PP request with browser with headers', function(done) {
    PayPro.get({
      url: 'http://an.url.com/paypro',
      xhr: xhr,
      env: 'browser',
      headers: {
        'Accept': 'xx/xxx',
        'Content-Type': 'application/octet-stream',
        'Content-Length': 0,
        'Content-Transfer-Encoding': 'xxx',
      }

    }, function(err, res) {
      should.not.exist(err);
      res.should.deep.equal(TestData.payProData);
      done();
    });
  });



  it('make a pp request with browser, with http error', function(done) {
    xhr.send = function() {
      xhr.onerror();
    };
    PayPro.get({
      url: 'http://an.url.com/paypro',
      xhr: xhr,
      env: 'browser',
    }, function(err, res) {
      err.should.be.an.instanceOf(Error);
      err.message.should.equal('HTTP Request Error');
      done();
    });
  });

  it('Make a PP request with browser, with http given error', function(done) {
    xhr.send = function() {
      xhr.onerror();
    };
    xhr.statusText = 'myerror';
    PayPro.get({
      url: 'http://an.url.com/paypro',
      xhr: xhr,
      env: 'browser',
    }, function(err, res) {
      err.should.be.an.instanceOf(Error);
      err.message.should.equal('myerror');
      done();
    });
  });


  it('Make a PP request with node', function(done) {
    xhr.send = function() {
      xhr.response = 'id';
      xhr.onload();
    };


    xhr.statusText = null;
    PayPro.get({
      url: 'http://an.url.com/paypro',
      httpNode: httpNode,
      env: 'node',
    }, function(err, res) {
      should.not.exist(err);
      res.should.deep.equal(TestData.payProData);
      done();
    });
  });

  it('Make a PP request with node with HTTP error', function(done) {
    httpNode.error = 404;
    PayPro.get({
      url: 'http://an.url.com/paypro',
      httpNode: httpNode,
      env: 'node',
    }, function(err, res) {
      err.should.be.an.instanceOf(Error);
      err.message.should.equal('HTTP Request Error');
      done();
    });
  });

  it('Create a PP payment', function() {
    var data = TestData.payProData;
    var payment = PayPro._createPayment(data.merchant_data, '12ab1234', 'mwRGmB4NE3bG4EbXJKTHf8uvodoUtMCRhZ', 100);
    var s = '';
    for (var i = 0; i < payment.length; i++) {
      s += payment[i].toString(16);
    }
    s.should.equal('a4c7b22696e766f6963654964223a22436962454a4a74473174394837374b6d4d3631453274222c226d65726368616e744964223a22444766754344656f66556e576a446d5537454c634568227d12412ab12341a1d864121976a914ae6eeec7e05624db748f9c16cce6fb53696ab3988ac');
  });

  it('Send a PP payment (browser)', function(done) {
    var data = TestData.payProData;
    var opts = {
      merchant_data: data.merchant_data,
      rawTx: '12ab1234',
      refundAddr: 'mwRGmB4NE3bG4EbXJKTHf8uvodoUtMCRhZ',
      amountSat: 100,
      url: 'http://an.url.com/paypro',
      xhr: xhr,
      env: 'browser',
    };
    var payment = PayPro.send(opts, function(err, data) {
      should.not.exist(err);
      done();
    });
  });

  it('Send a PP payment (node)', function(done) {
    httpNode.error = null;
    var data = TestData.payProData;
    var opts = {
      merchant_data: data.merchant_data,
      rawTx: '12ab1234',
      refundAddr: 'mwRGmB4NE3bG4EbXJKTHf8uvodoUtMCRhZ',
      amountSat: 100,
      httpNode: httpNode,
      url: 'http://an.url.com/paypro',
      env: 'node',
    };
    var payment = PayPro.send(opts, function(err, data) {
      should.not.exist(err);
      done();
    });
  });

});
