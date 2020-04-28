'use strict';

var _ = require('lodash');
var async = require('async');
var chai = require('chai');
var mongodb = require('mongodb');
var should = chai.should();
var { ChainService } = require('../../ts_build/lib/chain');
var { TxProposal } = require('../../ts_build/lib/model/txproposal');


describe('Chain BTC', function() {
 
  describe.only('#getBitcoreTx', function() {
    it('should create a valid bitcore TX', function() {
      var txp = TxProposal.fromObj(aTXP());
      var t = ChainService.getBitcoreTx(txp);
      should.exist(t);
    });
    it('should order outputs as specified by outputOrder', function() {
      var txp = TxProposal.fromObj(aTXP());

      txp.outputOrder = [0, 1, 2];
      var t = ChainService.getBitcoreTx(txp);
      t.getChangeOutput().should.deep.equal(t.outputs[2]);

      txp.outputOrder = [2, 0, 1];
      var t2 = ChainService.getBitcoreTx(txp);
      t2.getChangeOutput().should.deep.equal(t2.outputs[0]);
    });

    it('should create a valid signed bitcore TX', function() {
      var txp = TxProposal.fromObj(signedTxp);
      var t = ChainService.getBitcoreTx(txp);
      should.exist(t);
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

const signedTxp = 
  {
  actions:
   [ {
       version: '1.0.0',
       createdOn: 1588098977,
       copayerId:
        '671fee02a6c1c4de2e2609f9f9a6180dc03acfff6b759fe0b13a616ed4880065',
       type: 'accept',
       signatures: [Array],
       xpub:
        'xpub6DVmxcjRgZdHNSEcXSiFtweVwMSTc3TMwRJ45nJYvyqvLbK1poPerupqh87rSoz27wvckb1CKnGZoLmLXSZyNGZtVd7neqSvdwJL6fceQpe',
       comment: null } ],
  version: 3,
  createdOn: 1588098977,
  id: 'a6254d63-36bd-4188-b1e1-86256d45985c',
  walletId: '42477c2f-d153-4eb5-b074-262f2786fc7f',
  creatorId:
   '671fee02a6c1c4de2e2609f9f9a6180dc03acfff6b759fe0b13a616ed4880065',
  coin: 'bch',
  network: 'livenet',
  outputs:
   [ { amount: 80000000,
       toAddress: 'CPrtPWbp8cCftTQu5fzuLG5zPJNDHMMf8X' } ],
  amount: 80000000,
  message: 'some message',
  payProUrl: null,
  changeAddress:
   { version: '1.0.0',
     createdOn: 1588098977,
     address: 'CWwtFMy3GMr5qMEtvEdUDjePfShzkJXCnh',
     walletId: '42477c2f-d153-4eb5-b074-262f2786fc7f',
     isChange: true,
     path: 'm/1/0',
     publicKeys:
      [ '02129acdcc600694b3ce55a2d05244186e806174eb0bafde20e5a6395ded647857' ],
     coin: 'bch',
     network: 'livenet',
     type: 'P2PKH',
     hasActivity: null,
     beRegistered: null },
  inputs:
   [ { txid:
        '5330d40c22687978e5a8730fe4721111b17c00690d50272b14fd1e9b7f9792df',
       vout: 8,
       satoshis: 100000000,
       scriptPubKey: '76a914d391e62337ed194a1e428f32d14838e5d848180a88ac',
       address: 'qrfere3rxlk3jjs7g28n952g8rjasjqcpgx3axq70t',
       confirmations: 20,
       publicKeys: [Array],
       wallet: '42477c2f-d153-4eb5-b074-262f2786fc7f',
       path: 'm/0/1' } ],
  walletM: 1,
  walletN: 1,
  requiredSignatures: 1,
  requiredRejections: 1,
  status: 'accepted',
  txid:
   '9e6b24f7228891d92f889f6e7588a34e6d4c667947ae9ff1838a656cfcf1344d',
  broadcastedOn: null,
  inputPaths: [ 'm/0/1' ],
  outputOrder: [ 0, 1 ],
  fee: 2430,
  feeLevel: null,
  feePerKb: 10000,
  excludeUnconfirmedUtxos: false,
  addressType: 'P2PKH',
  customData: null,
  proposalSignature:
   '304402205d037ab133bf01012e011c1516ee8b8fe660ce5a3608b7a4af9ec7602921c90102202827fabe03a49c87d8fb9727734985ed6184b54fc05e0fc3a28d515c121d08be',
  signingMethod: 'ecdsa',
  proposalSignaturePubKey: null,
  proposalSignaturePubKeySig: null,
  lockUntilBlockHeight: null,
  gasPrice: null,
  from: null,
  nonce: null,
  gasLimit: null,
  data: null,
  tokenAddress: null,
  destinationTag: null,
  invoiceID: null,
  derivationStrategy: 'BIP44',
  creatorName: 'copayer 1',
  raw:
   '0100000001df92977f9b1efd142b27500d69007cb1111172e40f73a8e5787968220cd43053080000006b483045022100ffb59d748474aa5d8a33abb822b612fcccf7bc09af4d77a29ce8af076eb3641502204c1d2af69ab0d3e0576b4af72e27962c179934b098f6abf529f88d5dd091d0a74121024d27ca79a3ed27a143cb9d1dff01e4e6445294679a700ca404ca449211d08aa7ffffffff0200b4c404000000001976a91451224bca38efcaa31d5340917c3f3f713b8b20e488ac82233101000000001976a9149edd2399faccf4e57df08bef78962fa0228741cf88ac00000000',
  isPending: true }
;
