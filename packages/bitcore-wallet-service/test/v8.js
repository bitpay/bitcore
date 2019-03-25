'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var { V8 } = require('../ts_build/lib/blockchainexplorers/v8');
var B = require('bitcore-lib-cash');
const { Readable } = require('stream');

const V8UTXOS = [
{"_id":"5c1d4bc47adced963b3cddb9","chain":"BCH","network":"testnet","coinbase":false,"mintIndex":0,"spentTxid":"","mintTxid":"6e34d9b83631cd55ee09d907061332ba3c17246e3c1255543fb7a35e58c52e42","mintHeight":12,"spentHeight":-2,"address":"qrua7vsdmks4522wwv8rtamfph7g8s8vpq6a0g3veh","script":"76a914f9df320ddda15a294e730e35f7690dfc83c0ec0888ac","value":1000000,"confirmations":-1},
{"_id":"5c1e33e17adced963b776bcf","chain":"BCH","network":"testnet","coinbase":false,"mintIndex":0,"spentTxid":"","mintTxid":"fb1340bae2431f71c5f14d0c5893cbfb09042dcb9602b858ccec43e0e1e2f1a1","mintHeight":15,"spentHeight":-2,"address":"qrua7vsdmks4522wwv8rtamfph7g8s8vpq6a0g3veh","script":"76a914f9df320ddda15a294e730e35f7690dfc83c0ec0888ac","value":2000000,"confirmations":-1},
{"_id":"5c21088f7adced963b33eea2","chain":"BCH","network":"testnet","coinbase":false,"mintIndex":0,"spentTxid":"","mintTxid":"42eeb1d139521fa5206685ffec5df3b302cf85561201178680a0efe6bd23d449","mintHeight":-1,"spentHeight":-2,"address":"qrua7vsdmks4522wwv8rtamfph7g8s8vpq6a0g3veh","script":"76a914f9df320ddda15a294e730e35f7690dfc83c0ec0888ac","value":2000000,"confirmations":-1}];



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
});
