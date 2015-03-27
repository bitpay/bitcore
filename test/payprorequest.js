'use strict';

var _ = require('lodash');
var chai = chai || require('chai');
var sinon = sinon || require('sinon');
var should = chai.should();
var PayProReq = require('../lib/payprorequest');
var TestData = require('./testdata');


describe('payprorequest', function() {
  var xhr, http;
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

    http = {};
    http.get = function(opts, cb) {
      var res = {};
      res.statusCode = http.error || 200;
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
    PayProReq.get({
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
    PayProReq.get({
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
    PayProReq.get({
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
    PayProReq.get({
      url: 'http://an.url.com/paypro',
      xhr: xhr,
      env: 'browser',
    }, function(err, res) {
      err.should.contain('myerror');
      done();
    });
  });


  it('Make a PP request with node', function(done) {
    PayProReq.get({
      url: 'http://an.url.com/paypro',
      http: http,
      env: 'node',
    }, function(err, res) {
      should.not.exist(err);
      res.should.deep.equal(TestData.payProData);
      done();
    });
  });

  it('Make a PP request with node with HTTP error', function(done) {
    http.error = 404;
    PayProReq.get({
      url: 'http://an.url.com/paypro',
      http: http,
      env: 'node',
    }, function(err, res) {
      err.should.contain('HTTP Request Error');
      done();
    });
  });



});
