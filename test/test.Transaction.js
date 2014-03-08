'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');

var should = chai.should();

var TransactionModule = bitcore.Transaction;
var Transaction;

describe('Transaction', function() {
  it('should initialze the main object', function() {
    should.exist(TransactionModule);
  });
  it('should be able to create class', function() {
    Transaction = TransactionModule;
    should.exist(Transaction);
  });
  it('should be able to create instance', function() {
    var t = new Transaction();
    should.exist(t);
  });
});





