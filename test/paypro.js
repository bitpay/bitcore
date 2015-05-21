'use strict';

var _ = require('lodash');
var chai = chai || require('chai');
var sinon = sinon || require('sinon');
var should = chai.should();
var PayPro = require('../lib/paypro');
var TestData = require('./testdata');


describe('paypro', function() {
  var xhr, httpNode;
  before(function() {
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
      err.should.contain('HTTP Request Error');
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
      err.should.contain('myerror');
      done();
    });
  });


  it('Make a PP request with node', function(done) {
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
      err.should.contain('HTTP Request Error');
      done();
    });
  });



});
