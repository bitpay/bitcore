'use strict';

var should = require('chai').should();

var bitcore = require('../..');
var errors = bitcore.errors;
var $ = bitcore.util.preconditions;
var PrivateKey = bitcore.PrivateKey;

describe('preconditions', function() {

  it('can be used to assert state', function() {
    (function() {
      $.checkState(false, 'testing');
    }).should.throw(errors.InvalidState);
  });
  it('throws no false negative', function() {
    (function() {
      $.checkState(true, 'testing');
    }).should.not.throw();
  });

  it('can be used to check an argument', function() {
    (function() {
      $.checkArgument(false, 'testing');
    }).should.throw(errors.InvalidArgument);

    (function() {
      $.checkArgument(true, 'testing');
    }).should.not.throw(errors.InvalidArgument);
  });

  it('can be used to check an argument type', function() {
    var error;
    try {
      $.checkArgumentType(1, 'string', 'argumentName');
    } catch (e) {
      error = e;
      e.message.should.equal('Invalid Argument for argumentName, expected string but got number');
    }
    should.exist(error);
  });
  it('has no false negatives when used to check an argument type', function() {
    (function() {
      $.checkArgumentType('a String', 'string', 'argumentName');
    }).should.not.throw();
  });

  it('can be used to check an argument type for a class', function() {
    var error;
    try {
      $.checkArgumentType(1, PrivateKey);
    } catch (e) {
      error = e;
      var fail = !(~e.message.indexOf('Invalid Argument for (unknown name)'));
      fail.should.equal(false);
    }
    should.exist(error);
  });
  it('has no false negatives when checking a type for a class', function() {
    (function() {
      $.checkArgumentType(new PrivateKey(), PrivateKey);
    }).should.not.throw();
  });

  it('formats correctly a message on InvalidArgument()', function() {
    var error = new errors.InvalidArgument();
    error.message.should.equal('Invalid Argument');
  });

  it('formats correctly a message on checkArgument', function() {
    var error;
    try {
      $.checkArgument(null, 'parameter must be provided');
    } catch (e) {
      error = e;
    }
    error.message.should.equal('Invalid Argument: parameter must be provided');
  });
});
