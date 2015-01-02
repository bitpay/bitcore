'use strict';

var sinon = require('sinon');
var should = require('chai').should();
var expect = require('chai').expect;
var bitcore = require('../../..');

var Insight = bitcore.transport.explorers.Insight;
var Address = bitcore.Address;
var Transaction = bitcore.Transaction;
var Networks = bitcore.Networks;

describe('Insight', function() {

  describe('instantiation', function() {
    it('can be created without any parameters', function() {
      var insight = new Insight();
      insight.url.should.equal('https://insight.bitpay.com');
      insight.network.should.equal(Networks.livenet);
    });
    it('can be created providing just a network', function() {
      var insight = new Insight(Networks.testnet);
      insight.url.should.equal('https://test-insight.bitpay.com');
      insight.network.should.equal(Networks.testnet);
    });
    it('can be created with a custom url', function() {
      var url = 'https://localhost:1234';
      var insight = new Insight(url);
      insight.url.should.equal(url);
    });
    it('can be created with a custom url and network', function() {
      var url = 'https://localhost:1234';
      var insight = new Insight(url, Networks.testnet);
      insight.url.should.equal(url);
      insight.network.should.equal(Networks.testnet);
    });
    it('defaults to defaultNetwork on a custom url', function() {
      var insight = new Insight('https://localhost:1234');
      insight.network.should.equal(Networks.defaultNetwork);
    });
  });

  describe('getting unspent utxos', function() {
    var insight = new Insight();
    var address = '371mZyMp4t6uVtcEr4DAAbTZyby9Lvia72';
    beforeEach(function() {
      insight.requestPost = sinon.stub();
      insight.requestPost.onFirstCall().callsArgWith(2, null, {statusCode: 200});
    });
    it('can receive an address', function(callback) {
      insight.getUnspentUtxos(new Address(address), callback);
    });
    it('can receive a address as a string', function(callback) {
      insight.getUnspentUtxos(address, callback);
    });
    it('can receive an array of addresses', function(callback) {
      insight.getUnspentUtxos([address, new Address(address)], callback);
    });
    it('errors if server is not available', function(callback) {
      insight.requestPost.onFirstCall().callsArgWith(2, 'Unable to connect');
      insight.getUnspentUtxos(address, function(error) {
        expect(error).to.equal('Unable to connect');
        callback();
      });
    });
    it('errors if server returns errorcode', function(callback) {
      insight.requestPost.onFirstCall().callsArgWith(2, null, {statusCode: 400});
      insight.getUnspentUtxos(address, function(error) {
        expect(error).to.deep.equal({statusCode: 400});
        callback();
      });
    });
  });

  describe('broadcasting a transaction', function() {
    var insight = new Insight();
    var tx = require('../../data/tx_creation.json')[0][7];
    beforeEach(function() {
      insight.requestPost = sinon.stub();
      insight.requestPost.onFirstCall().callsArgWith(2, null, {statusCode: 200});
    });
    it('accepts a raw transaction', function(callback) {
      insight.broadcast(tx, callback);
    });
    it('accepts a transaction model', function(callback) {
      insight.broadcast(new Transaction(tx), callback);
    });
    it('errors if server is not available', function(callback) {
      insight.requestPost.onFirstCall().callsArgWith(2, 'Unable to connect');
      insight.broadcast(tx, function(error) {
        expect(error).to.equal('Unable to connect');
        callback();
      });
    });
    it('errors if server returns errorcode', function(callback) {
      insight.requestPost.onFirstCall().callsArgWith(2, null, {statusCode: 400}, 'error');
      insight.broadcast(tx, function(error) {
        expect(error).to.equal('error');
        callback();
      });
    });
  });
});
