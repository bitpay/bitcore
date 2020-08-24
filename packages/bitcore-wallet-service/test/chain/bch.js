'use strict';

var _ = require('lodash');
var async = require('async');
var chai = require('chai');
var mongodb = require('mongodb');
var should = chai.should();
const { BitcoreLibCash } = require ('crypto-wallet-core');
const { ChainService } = require('../../ts_build/lib/chain');
const { BchChain } = require('../../ts_build/lib/chain/bch');
const { TxProposal } = require('../../ts_build/lib/model/txproposal');

const Common = require('../../ts_build/lib/common');
const Constants = Common.Constants;

describe('Chain BCH', function() {
 

  describe('#getEstimatedSize', function() {
    let bch, fromAddress, simpleUtxoWith1BTC, changeAddress, toAddress, privateKey;

    before(function()  {
      bch = new BchChain();
      fromAddress = 'qzydnyc75u7kp6hhu4n3alq922u39ygl9gc3t4e2ma';
      toAddress = 'qped668nq9ltx2x0y85ls7mkp6xkxmg89y85s8lyla';
      changeAddress = 'qqjuuqsjgamj3lj2a6jaje6wckm8qdkwyvq3quku7x2';
      privateKey = 'L1po2S57VttbmpwdnFb8aWicXWnUaQBnDxY3kpChZsywDqrFdjXE';
      simpleUtxoWith1BTC = {
        address: fromAddress,
        txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
        outputIndex: 0,
        script: BitcoreLibCash.Script.buildPublicKeyHashOut(fromAddress).toString(),
        satoshis: 1e8,
      };

      const privKey = new BitcoreLibCash.PrivateKey();

    });
    it('1  input p2pkh,1 output p2pkh: Margin should be 10%  ', function() {
      let x = TxProposal.fromObj(aTXP());
      delete x.changeAddress;
      x.outputs.pop();
      x.addressType =   Constants.SCRIPT_TYPES.P2PKH;
      const estimatedLength = bch.getEstimatedSize(x);

      // Create a similar TX.
      let tx = new BitcoreLibCash.Transaction();
      tx.from(simpleUtxoWith1BTC)
        .to([{address: toAddress, satoshis: 1e8-7000}])
        .sign(privateKey);

      const actualLength = tx.serialize().length/2;


      // Check margin is ~0.1
      ((Math.abs(actualLength-estimatedLength))/actualLength).should.be.above(0.05);
      ((Math.abs(actualLength-estimatedLength))/actualLength).should.be.below(0.15);
    });

 
  });
});


var aTXP = function() {
  var txp = {
    "version": 3,
    "createdOn": 1423146231,
    "id": "75c34f49-1ed6-255f-e9fd-0c71ae75ed1e",
    "walletId": "1",
    "creatorId": "1",
    "coin": "bch",
    "network": "livenet",
    "amount": 30000000,
    "message": 'some message',
    "proposalSignature": '7035022100896aeb8db75fec22fddb5facf791927a996eb3aee23ee6deaa15471ea46047de02204c0c33f42a9d3ff93d62738712a8c8a5ecd21b45393fdd144e7b01b5a186f1f9',
    "changeAddress": {
      "version": '1.0.0',
      "createdOn": 1424372337,
      "address": '3CauZ5JUFfmSAx2yANvCRoNXccZ3YSUjXH',
      "path": 'm/2147483647/1/0',
      "publicKeys": ['030562cb099e6043dc499eb359dd97c9d500a3586498e4bcf0228a178cc20e6f16',
        '0367027d17dbdfc27b5e31f8ed70e14d47949f0fa392261e977db0851c8b0d6fac',
        '0315ae1e8aa866794ae603389fb2b8549153ebf04e7cdf74501dadde5c75ddad11'
      ]
    },
    "inputs": [{
      "txid": "6ee699846d2d6605f96d20c7cc8230382e5da43342adb11b499bbe73709f06ab",
      "vout": 8,
      "satoshis": 100000000,
      "scriptPubKey": "a914a8a9648754fbda1b6c208ac9d4e252075447f36887",
      "address": "3H4pNP6J4PW4NnvdrTg37VvZ7h2QWuAwtA",
      "path": "m/2147483647/0/1",
      "publicKeys": ["0319008ffe1b3e208f5ebed8f46495c056763f87b07930a7027a92ee477fb0cb0f", "03b5f035af8be40d0db5abb306b7754949ab39032cf99ad177691753b37d101301"]
    }],
    "inputPaths": ["m/2147483647/0/1"],
    "requiredSignatures": 2,
    "requiredRejections": 1,
    "walletN": 2,
    "addressType": "P2SH",
    "status": "pending",
    "actions": [],
    "fee": 10000,
    "outputs": [{
      "toAddress": "qq0zkyfjkjfec47hgcu0acdzw36td4s2evqyyllszk",
      "amount": 10000000,
      "message": "first message"
    }, {
      "toAddress": "qq0zkyfjkjfec47hgcu0acdzw36td4s2evqyyllszk",
      "amount": 20000000,
      "message": "second message"
    }, ],
    "outputOrder": [0, 1, 2]
  };

  return txp;
};


