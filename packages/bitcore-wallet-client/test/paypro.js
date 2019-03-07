'use strict';

var _ = require('lodash');
var chai = chai || require('chai');
var sinon = sinon || require('sinon');
var should = chai.should();
var PayPro = require('../lib/paypro');
var TestData = require('./testdata');



var serverCoin = 'btc';

describe('paypro', function() {
  var xhr, httpNode, clock, headers;
  before(function() {
    // Stub time before cert expiration at Mar 27 2016
    clock = sinon.useFakeTimers(1459105693843);


      xhr.response = Buffer.from(TestData.payProJsonHex[serverCoin],'hex');
      xhr.onload();
    };

    httpNode = {};
    httpNode.request = function(opts, cb) {
      var res = {};
      res.statusCode = httpNode.error || 200;
      if (httpNode.error == 404) 
        res.statusMessage = 'Not Found';
      res.on = function(e, cb) {
        if (e == 'data') {
          return cb(Buffer.from(TestData.payProJsonHex[serverCoin],'hex'));
        }
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
  beforeEach(() => {
    serverCoin = 'btc';
  });
  after(function() {
    clock.restore();
  });

  it('Make a PP request with browser', function(done) {
    xhr.status=200;
    serverCoin='btc';

    // Get it thru xhr mock up
    PayPro.get({
      url: 'http://an.url.com/paypro',
      xhr: xhr,
      env: 'browser',
    }, function(err, res) {
      headers['Accept'].should.equal('application/payment-request');

      // Get it thru http mock up
      PayPro.get({
        url: 'http://an.url.com/paypro',
        xhr: null,
        http: function (opts, cb) {
          return cb(null, Buffer.from(TestData.payProJsonHex['btc'],'hex'));
        }
      }, function(err, res2) {
        should.not.exist(err);

        // they should be equal...
        res2.should.be.deep.equal(res);
        done();
      });
    });
  });


  it('Should handle a failed request from the browser', function(done) {
    xhr.status=404;
    serverCoin='btc';
    PayPro.get({
      url: 'http://an.url.com/paypro',
      xhr: xhr,
      env: 'browser',
    }, function(err, res) {
      headers['Accept'].should.equal('application/payment-request');
      should.exist(err);
      done();
    });
  });



  it('Make a PP request with browser BCH', function(done) {
    xhr.status=200;
    serverCoin='bch';
    PayPro.get({
      url: 'http://an.url.com/paypro',
      xhr: xhr,
      env: 'browser',
      coin: 'bch',
    }, function(err, res) {
      should.not.exist(err);
      headers['Accept'].should.equal('application/payment-request');

      // Get it thru http mock up
      PayPro.get({
        url: 'http://an.url.com/paypro',
        xhr: null,
        http: function (opts, cb) {
          return cb(null, Buffer.from(TestData.payProJsonHex['bch'],'hex'));
        },
        coin: 'bch',
      }, function(err, res2) {
        should.not.exist(err);

        // they should be equal...
        res2.should.be.deep.equal(res);
        done();
      });
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
      },
    }, function(err, res) {
      should.not.exist(err);
      res.should.deep.equal(TestData.payProJsonData['btc']);
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
      res.should.deep.equal(TestData.payProJsonData.btc);
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
      err.message.should.equal('HTTP Request Error: 404 Not Found ');
      done();
    });
  });

  it('Send a PP payment (browser, BTC)', function(done) {
    var opts = {
      rawTx: 'rawTx1',
      rawTxUnsigned: 'rawTxUnsigned',
      url: 'http://an.url.com/paypro',
      xhr: xhr,
      env: 'browser',
    }
    xhr.status= 200;

    var calls=0;
    xhr.send = function() {
      if (!calls++) {
        xhr.response = 'Payment seems OK';
      } else {
        xhr.response = '{"memo":"memo1"}';
      }
      xhr.onload();
    };

    var payment = PayPro.send(opts, function(err, data, memo) {
      should.not.exist(err);
      memo.should.equal('memo1');
      done();
    });
  });

  it('Should not send a PP payment is verify failed (browser, BTC)', function(done) {
    var opts = {
      rawTx: 'rawTx1',
      rawTxUnsigned: 'rawTxUnsigned',
      url: 'http://an.url.com/paypro',
      xhr: xhr,
      env: 'browser',
    }
    xhr.status= 400;

    var calls=0;
    xhr.send = function() {
      if (!calls++) {
        xhr.response = 'xx';
      } else {
        // should never get hehe
        'xx'.should.equal('yy');
      }
      xhr.onload();
    };

    var payment = PayPro.send(opts, function(err, data, memo) {
      err.should.equal('xx');
      done();
    });
  });



  it('Send a PP payment (browser, BCH)', function(done) {
    var data = TestData.payProData;
    var opts = { 
      rawTx: 'rawTx1',
      rawTxUnsigned: 'rawTxUnsigned',
      url: 'http://an.url.com/paypro',
      xhr: xhr,
      env: 'browser',
      coin: 'bch',
    };
    xhr.status= 200;

    var calls=0;
    xhr.send = function() {
      if (!calls++) {
        xhr.response = 'Payment seems OK';
      } else {
        xhr.response = '{"memo":"memo1"}';
      }
      xhr.onload();
    };



    var payment = PayPro.send(opts, function(err, data, memo) {
      headers['Content-Type'].should.equal('application/payment');
      should.not.exist(err);
      memo.should.equal('memo1');
      done();
    });
  });



  it('Send a PP payment (node)', function(done) {
    httpNode.error = null;
    var data = TestData.payProData;
    var opts = {
      rawTx: '12ab1234',
      rawTxUnsigned: 'rawTxUnsigned',
      url: 'http://an.url.com/paypro',
      httpNode: httpNode,
      env: 'node',
    };
    var payment = PayPro.send(opts, function(err, data) {
      should.not.exist(err);
      done();
    });
  });

});
