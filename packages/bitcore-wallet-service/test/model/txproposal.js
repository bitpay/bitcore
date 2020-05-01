'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var { TxProposal } = require('../../ts_build/lib/model/txproposal');
var Bitcore = require('bitcore-lib');

describe('TxProposal', function() {
  describe('#create', function() {
    it('should create a TxProposal', function() {
      var txp = TxProposal.create(aTxpOpts());
      should.exist(txp);
      txp.outputs.length.should.equal(2);
      txp.amount.should.equal(30000000);
      txp.network.should.equal('livenet');
    });
  });

  describe('#fromObj', function() {
    it('should copy a TxProposal', function() {
      var txp = TxProposal.fromObj(aTXP());
      should.exist(txp);
      txp.amount.should.equal(aTXP().amount);
    });

    it('should copy a TxProposal, with actions', function() {
      let txpObj  = aTXP();


      txpObj.version = 2;
      txpObj.actions = [{
        version: '1.0.0',
        createdOn: 1,
        copayerId: 1,
        type: 'xx',
        signatures: 'ss',
        xpub: 'xx',
      }];
      
      var txp = TxProposal.fromObj(txpObj);
      should.exist(txp);
      txp.amount.should.equal(aTXP().amount);
    });



    it('should default to BTC coin', function() {
      var txp = TxProposal.fromObj(aTXP());
      should.exist(txp);
      txp.coin.should.equal('btc');
    });
  });

  describe('#getTotalAmount', function() {
    it('should compute total amount', function() {
      var x = TxProposal.fromObj(aTXP());
      var total = x.getTotalAmount();
      total.should.equal(x.amount);
    });
  });

  describe('#sign', function() {
    it('should sign 2-2 (txp version 3, btc tx version 1)', function() {
      var txp = TxProposal.fromObj(aTXP());
      txp.sign('1', theSignatures, theXPub);
      txp.isAccepted().should.equal(false);
      txp.isRejected().should.equal(false);
      txp.sign('2', theSignatures, theXPub);
      txp.isAccepted().should.equal(true); //<===
      txp.isRejected().should.equal(false);
    });
  });

  describe('#getRawTx', function() {
    it('should generate correct raw transaction for signed 2-2, tx version 1', function() {
      var txp = TxProposal.fromObj(aTXP());
      txp.sign('1', theSignatures, theXPub);
      txp.getRawTx().should.equal(theRawTx);
    });
  });

  describe('#reject', function() {
    it('should reject 2-2', function() {
      var txp = TxProposal.fromObj(aTXP());
      txp.reject('1');
      txp.isAccepted().should.equal(false);
      txp.isRejected().should.equal(true);
    });
  });

  describe('#reject & #sign', function() {
    it('should finally reject', function() {
      var txp = TxProposal.fromObj(aTXP());
      txp.sign('1', theSignatures);
      txp.isAccepted().should.equal(false);
      txp.isRejected().should.equal(false);
      txp.reject('2');
      txp.isAccepted().should.equal(false);
      txp.isRejected().should.equal(true);
    });
  });

});

var theXPriv = 'xprv9s21ZrQH143K2rMHbXTJmWTuFx6ssqn1vyRoZqPkCXYchBSkp5ey8kMJe84sxfXq5uChWH4gk94rWbXZt2opN9kg4ufKGvUM7HQSLjnoh7e';
var theXPub = 'xpub661MyMwAqRbcFLRkhYzK8eQdoywNHJVsJCMQNDoMks5bZymuMcyDgYfnVQYq2Q9npnVmdTAthYGc3N3uxm5sEdnTpSqBc4YYTAhNnoSxCm9';
var theSignatures = ['304402201d210f731fa8cb8473ce49554382ad5d950c963d48b173a0591f13ed8cee10ce022027b30dc3a55c46b1f977a72491d338fc14b6d13a7b1a7c5a35950d8543c1ced6'];
var theRawTx = '0100000001ab069f7073be9b491bb1ad4233a45d2e383082ccc7206df905662d6d8499e66e08000000910047304402201d210f731fa8cb8473ce49554382ad5d950c963d48b173a0591f13ed8cee10ce022027b30dc3a55c46b1f977a72491d338fc14b6d13a7b1a7c5a35950d8543c1ced6014752210319008ffe1b3e208f5ebed8f46495c056763f87b07930a7027a92ee477fb0cb0f2103b5f035af8be40d0db5abb306b7754949ab39032cf99ad177691753b37d10130152aeffffffff0380969800000000001976a91451224bca38efcaa31d5340917c3f3f713b8b20e488ac002d3101000000001976a91451224bca38efcaa31d5340917c3f3f713b8b20e488ac70f62b040000000017a914778192003f0e9e1d865c082179cc3dae5464b03d8700000000';

var aTxpOpts = function() {
  var opts = {
    coin: 'btc',
    network: 'livenet',
    message: 'some message'
  };
  opts.outputs = [{
    toAddress: "18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7",
    amount: 10000000,
    message: "first message"
  }, {
    toAddress: "18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7",
    amount: 20000000,
    message: "second message"
  }, ];

  return opts;
};

var aTXP = function() {
  var txp = {
    "version": 3,
    "createdOn": 1423146231,
    "id": "75c34f49-1ed6-255f-e9fd-0c71ae75ed1e",
    "walletId": "1",
    "creatorId": "1",
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
      "toAddress": "18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7",
      "amount": 10000000,
      "message": "first message"
    }, {
      "toAddress": "18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7",
      "amount": 20000000,
      "message": "second message"
    }, ],
    "outputOrder": [0, 1, 2]
  };

  return txp;
};
