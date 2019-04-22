'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var { V8 } = require('../ts_build/lib/blockchainexplorers/v8');
var B = require('bitcore-lib-cash');
const { Readable } = require('stream');
var Common = require('../ts_build/lib/common');
var Defaults = Common.Defaults;

const V8UTXOS = [
{"_id":"5c1d4bc47adced963b3cddb9","chain":"BCH","network":"testnet","coinbase":false,"mintIndex":0,"spentTxid":"","mintTxid":"6e34d9b83631cd55ee09d907061332ba3c17246e3c1255543fb7a35e58c52e42","mintHeight":12,"spentHeight":-2,"address":"qrua7vsdmks4522wwv8rtamfph7g8s8vpq6a0g3veh","script":"76a914f9df320ddda15a294e730e35f7690dfc83c0ec0888ac","value":1000000,"confirmations":-1},
{"_id":"5c1e33e17adced963b776bcf","chain":"BCH","network":"testnet","coinbase":false,"mintIndex":0,"spentTxid":"","mintTxid":"fb1340bae2431f71c5f14d0c5893cbfb09042dcb9602b858ccec43e0e1e2f1a1","mintHeight":15,"spentHeight":-2,"address":"qrua7vsdmks4522wwv8rtamfph7g8s8vpq6a0g3veh","script":"76a914f9df320ddda15a294e730e35f7690dfc83c0ec0888ac","value":2000000,"confirmations":-1},
{"_id":"5c21088f7adced963b33eea2","chain":"BCH","network":"testnet","coinbase":false,"mintIndex":0,"spentTxid":"","mintTxid":"42eeb1d139521fa5206685ffec5df3b302cf85561201178680a0efe6bd23d449","mintHeight":-1,"spentHeight":-2,"address":"qrua7vsdmks4522wwv8rtamfph7g8s8vpq6a0g3veh","script":"76a914f9df320ddda15a294e730e35f7690dfc83c0ec0888ac","value":2000000,"confirmations":-1}];


const V8UTXOS2 = [ 
  { _id: '5cb4f9d612025b0a3931b13c', chain: 'BTC', network: 'mainnet', coinbase: false, mintIndex: 0, spentTxid: '', mintTxid: '623f72b089da60a179d7b85b50ed655e8580747ee06f2f77369cacfb99de11a0', mintHeight: 571792, spentHeight: -2, address: '38o49rd64PFDmvUV7928K1a5SRnoVgJSFW', script: 'a9144ded3cc47fcf6883a78c29134f90b0c1b0c368c887', value: 109810934, confirmations: 126 },
  { _id: '5cb503e612025b0a393d2ea9', chain: 'BTC', network: 'mainnet', coinbase: false, mintIndex: 0, spentTxid: '', mintTxid: '06ab9db9100409132a4c1367b87f16983938007dbae7b96a0746a64a7755e3e6', mintHeight: 571797, spentHeight: -2, address: '36pUaXzGouNdCqUDRWRXX9NJYungJEWJC2', script: 'a9143841ca886a1c4276966a77a15d0d1c4fe1e841bd87', value: 350000000, confirmations: 121 }]; 

var t = (new Date).toISOString();
var external = '11234';
var txs = [{
  id: 1,
  txid: 'txid1',
  blockTime: t,
  size: 226,
  category: 'send',
  toAddress: external,
  satoshis: 0.5e8,
},
{
  id: 2,
  txid: 'txid2',
  category: 'send',
  blockTime: t,
  satoshis: 0.3e8,
  toAddress: external,
},
{
  id: 3,
  txid: 'txid3',
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
      class PartialJson {
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
      class PartialJsonL {
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

  describe('#getAddressUtxos', () => {
    it('should get uxtos', (done) => {


      class PartialJson {
        getAddressTxos(opts) {
          return new Promise(function (resolve) {
            resolve(V8UTXOS);
          })
        };
      };

      var be = new V8({
        coin: 'bch',
        network: 'livenet',
        url: 'http://dummy/',
        apiPrefix: 'dummyPath',
        userAgent: 'testAgent',
        client: PartialJson,
      });

      be.getAddressUtxos('1EU9VhWRN7aW38pGk7qj3c2EDcUGDZKESt', 15, (err, utxos) => {
        should.not.exist(err);
        should.exist(utxos);
        let x = utxos[2];
        x.confirmations.should.equal(0);
        x.address.should.equal('qrua7vsdmks4522wwv8rtamfph7g8s8vpq6a0g3veh');
        x.satoshis.should.equal(2000000);
        x.amount.should.equal(x.satoshis/1e8);
        x.scriptPubKey.should.equal('76a914f9df320ddda15a294e730e35f7690dfc83c0ec0888ac');
        x.txid.should.equal('42eeb1d139521fa5206685ffec5df3b302cf85561201178680a0efe6bd23d449');
        x.vout.should.equal(0);

        utxos[1].confirmations.should.equal(1);
        utxos[0].confirmations.should.equal(4);

        return done();
      });
    });

    it('should get uxtos 2', (done) => {


      class PartialJson {
        getAddressTxos(opts) {
          return new Promise(function (resolve) {
            resolve(V8UTXOS2);
          })
        };
      };

      var be = new V8({
        coin: 'bch',
        network: 'livenet',
        url: 'http://dummy/',
        apiPrefix: 'dummyPath',
        userAgent: 'testAgent',
        client: PartialJson,
      });

      be.getAddressUtxos('36pUaXzGouNdCqUDRWRXX9NJYungJEWJC2', 571920, (err, utxos) => {
        should.not.exist(err);
        should.exist(utxos);
        let x = utxos[1];
        x.confirmations.should.equal(124);
        x.satoshis.should.equal(350000000);
        x.amount.should.equal(3.5);
        return done();
      });
    });

  });

  describe('#estimateFee', () => {
    it('should estimate fee', (done) => {

      let fakeRequest = {
        get: sinon.stub().resolves('{"feerate":0.00017349,"blocks":5}'),
      };

      var be = new V8({
        coin: 'bch',
        network: 'livenet',
        url: 'http://dummy/',
        apiPrefix: 'dummyPath',
        userAgent: 'testAgent',
        request: fakeRequest,
      });

      be.estimateFee([5], (err, levels) => {
        should.not.exist(err);
        should.exist(levels);
        // should ignore non-matching results
        levels.should.deep.equal({ '5': 0.00017349 });
        return done();
      });
    });

    it('should ignore non-matching results from estimate fee', (done) => {

      let fakeRequest = {
        get: sinon.stub().resolves('{"feerate":0.00017349,"blocks":4}'),
      };

      var be = new V8({
        coin: 'bch',
        network: 'livenet',
        url: 'http://dummy/',
        apiPrefix: 'dummyPath',
        userAgent: 'testAgent',
        request: fakeRequest,
      });

      be.estimateFee([1,2,3,4,5], (err, levels) => {
        should.not.exist(err);
        should.exist(levels);
        // should ignore non-matching results
        levels.should.deep.equal({ '4': 0.00017349 });
        return done();
      });
    });

    it('should use results from estimate fee is blocks is not present', (done) => {

      let fakeRequest = {
        get: sinon.stub().resolves('{"feerate":0.00017349}'),
      };

      var be = new V8({
        coin: 'bch',
        network: 'livenet',
        url: 'http://dummy/',
        apiPrefix: 'dummyPath',
        userAgent: 'testAgent',
        request: fakeRequest,
      });

      be.estimateFee([1,2,3,4,5], (err, levels) => {
        should.not.exist(err);
        should.exist(levels);
        levels.should.deep.equal({ '1': 0.00017349,
          '2': 0.00017349,
          '3': 0.00017349,
          '4': 0.00017349,
          '5': 0.00017349 });
        return done();
      });
    });

  });


  describe('#broadcast', () => {
    it('should broadcast a TX', (done) => {
      class BroadcastOk {
        broadcast(payload) {
          return new Promise(function (resolve) {
            resolve({'txid':'txid'});
          })
        };
      };

      var be = new V8({
        coin: 'bch',
        network: 'livenet',
        url: 'http://dummy/',
        apiPrefix: 'dummyPath',
        userAgent: 'testAgent',
        client: BroadcastOk,
      });

      be.broadcast('xxx', (err, txid) => {
        should.not.exist(err);
        txid.should.equal('txid');
        done();
      });
    });

    it('should fail to broadcast an invalid TX', (done) => {
      class BroadcastInvalid {
        broadcast(payload) {
          return new Promise(function (resolve) {
            resolve('invalid');
          })
        };
      };

      var be = new V8({
        coin: 'bch',
        network: 'livenet',
        url: 'http://dummy/',
        apiPrefix: 'dummyPath',
        userAgent: 'testAgent',
        client: BroadcastInvalid,
      });

      be.broadcast('xxx', (err, txid) => {
        should.not.exist(txid);
        err.toString().should.contain('Error');
        done();
      });
    });


    it('should retry to broadcast is socket hang up', (done) => {
      var oldd = Defaults.BROADCAST_RETRY_TIME;
      Defaults.BROADCAST_RETRY_TIME = 5;
      var x=0;
      class BroadcastInvalid {
        broadcast(payload) {
          return new Promise(function (resolve,reject) {
            if (x++<2) {
              reject('socket err or');
            } else {
              resolve({'txid':'txid'});
            }
          })
        };
      };

      var be = new V8({
        coin: 'bch',
        network: 'livenet',
        url: 'http://dummy/',
        apiPrefix: 'dummyPath',
        userAgent: 'testAgent',
        client: BroadcastInvalid,
      });

      be.broadcast('xxx', (err, txid) => {
        should.not.exist(err);
        txid.should.equal('txid');
        Defaults.BROADCAST_RETRY_TIME = oldd;
        done();
      });
    });

  });
});
