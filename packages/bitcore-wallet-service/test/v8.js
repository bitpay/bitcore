'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var V8 = require('../lib/blockchainexplorers/v8.js');
var B = require('bitcore-lib-cash');
const { Readable } = require('stream');



class Client {
  constructor() {
  }
  listTransactions () {
  }
};

var t = (new Date).toISOString();
var external = '11234';
var txs = [{
  id: 1,
  txid: 'txid1',
  confirmations: 1,
  blockTime: t,
  size: 226,
  category: 'send',
  toAddress: external,
  satoshis: 0.5e8,
},
{
  id: 2,
  txid: 'txid2',
  confirmations: 1,
  category: 'send',
  blockTime: t,
  satoshis: 0.3e8,
  toAddress: external,
},
{
  id: 3,
  txid: 'txid3',
  confirmations: 1,
  blockTime: t,
  satoshis: 5460,
  category: 'fee',
},
]; 


describe('V8', () => {
  var wallet={};

  wallet.beAuthPrivateKey2= new B.PrivateKey();

  describe('#listTransactions', () => {
    it('should handle partial json results', (done) => {
      class PartialJson extends Client {
        listTransactions(opts) {
          class MyReadable extends Readable {
            constructor(options) {
              super(options);
              var txStr = JSON.stringify(txs);
              this.push(txStr.substr(0,10));
              this.push(txStr.substr(10));
              this.push(null);
              }
          };

          return new MyReadable;
        };
      };
      
      var be = new V8({
        coin: 'btc',
        network: 'livenet',
        url: 'http://dummy/',
        apiPrefix: 'dummyPath',
        userAgent: 'testAgent',
        addressFormat: null,
        client: PartialJson,
      });

      be.getTransactions(wallet, 0, (err, txs) => {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(3);
        return done();
      });
    });

    it('should handle partial jsonline results', (done) => {
      class PartialJsonL extends Client {
        listTransactions(opts) {
          class MyReadable extends Readable {
            constructor(options) {
              super(options);
              var txStr = '{ "id": 1, "txid": "txid1", "confirmations": 1, "blockTime": "'+ 
                t + '", "size": 226, "category": "send", "toAddress": "'+
                external +'", "satoshis": 0.5e8 } \n { "id": 2, "txid": "txid2", "confirmations": 1, "category": "send", "blockTime": "'+
                t + '", "satoshis": 0.3e8, "toAddress": "'+external + '"}'; 
              this.push(txStr.substr(0,10));
              this.push(txStr.substr(10));
              this.push(null);
              }
          };

          return new MyReadable;
        };
      };
      var be2 = new V8({
        coin: 'btc',
        network: 'livenet',
        url: 'http://dummy/',
        apiPrefix: 'dummyPath',
        userAgent: 'testAgent',
        addressFormat: null,
        client: PartialJsonL,
      });
      be2.getTransactions(wallet, 0, (err, txs) => {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(2);
        return done();
      });
    });

  });
  describe.skip('#deregistedwallet', () => {
  });
});
