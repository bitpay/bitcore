'use strict';

var bitcore = require('../..');
var Script = bitcore.Script;

module.exports = [
  [
    'from', [{
      address: 'mszYqVnqKoQx4jcTdJXxwKAissE3Jbrrc1',
      txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
      outputIndex: 0,
      script: Script.buildPublicKeyHashOut('mszYqVnqKoQx4jcTdJXxwKAissE3Jbrrc1').toString(),
      satoshis: 1020000
    }],
    'to', ['mrU9pEmAx26HcbKVrABvgL7AwA5fjNFoDc', 1010000],
    'sign', ['cSBnVM4xvxarwGQuAfQFwqDg9k5tErHUHzgWsEfD4zdwUasvqRVY'],
    'serialize', '01000000015884e5db9de218238671572340b207ee85b628074e7e467096c267266baf77a4000000006a473044022013fa3089327b50263029265572ae1b022a91d10ac80eb4f32f291c914533670b02200d8a5ed5f62634a7e1a0dc9188a3cc460a986267ae4d58faf50c79105431327501210223078d2942df62c45621d209fab84ea9a7a23346201b7727b9b45a29c4e76f5effffffff0150690f00000000001976a9147821c0a3768aa9d1a37e16cf76002aef5373f1a888ac00000000'
  ],
  [
    'from', [{
      "txid" : "e42447187db5a29d6db161661e4bc66d61c3e499690fe5ea47f87b79ca573986",
      "vout" : 1,
      "address" : "mgBCJAsvzgT2qNNeXsoECg2uPKrUsZ76up",
      "scriptPubKey" : "76a914073b7eae2823efa349e3b9155b8a735526463a0f88ac",
      "amount" : 0.01080000,
    }],
    'to', ['mn9new5vPYWuVN5m3gUBujfKh1uPQvR9mf', 500000],
    'to', ['mw5ctwgEaNRbxkM4JhXH3rp5AyGvTWDZCD', 570000],
    'sign', ['cSQUuwwJBAg6tYQhzqqLWW115D1s5KFZDyhCF2ffrnukZxMK6rNZ'],
    'serialize', '0100000001863957ca797bf847eae50f6999e4c3616dc64b1e6661b16d9da2b57d184724e4010000006b4830450221009d23f7c1e790ecf839e0e53248dacfa559194735e477aa3ee5897fd74fe3ec0402205eff578518e7c59beeb03ee85e5c4b5bc2730addca2f0321d80aadfbcc1976de0121039dd446bbc85db6917f39c0b4c295b0f8cce76d1926fa76d7b84e3f7ff1c5eec5ffffffff0220a10700000000001976a91448c819246ae5645ceecd41fbe1aa6202a0a9b5ca88ac90b20800000000001976a914aab76ba4877d696590d94ea3e02948b55294815188ac00000000'
  ],
  [
    'from', [[{
      "txid" : "a9db84566e0fc9351e86337d2828ab281b25ddc06fab798f6d4b5baef48c02b3",
      "vout" : 0,
      "address" : "mn9new5vPYWuVN5m3gUBujfKh1uPQvR9mf",
      "account" : "",
      "scriptPubKey" : "76a91448c819246ae5645ceecd41fbe1aa6202a0a9b5ca88ac",
      "amount" : 0.00500000,
      "confirmations" : 0
    }, {
      "txid" : "a9db84566e0fc9351e86337d2828ab281b25ddc06fab798f6d4b5baef48c02b3",
      "vout" : 1,
      "address" : "mw5ctwgEaNRbxkM4JhXH3rp5AyGvTWDZCD",
      "account" : "",
      "scriptPubKey" : "76a914aab76ba4877d696590d94ea3e02948b55294815188ac",
      "amount" : 0.00570000,
      "confirmations" : 0
    }]],
    'to', ['mtymcCX5KixPjT1zxtg59qewBGWptj9etH', 1060000],
    'sign', [['cPGbA2C54ZZ1sw4dc2ckBE1WqkdrNSbEV8Tkjhi2p1J15oErdgP2', 'cSpyve5bXAuyHrNeV9MjTdFz3HLw739yUjjUAUSMe3ppf2qzj2hw']],
    'serialize', '0100000002b3028cf4ae5b4b6d8f79ab6fc0dd251b28ab28287d33861e35c90f6e5684dba9000000006a47304402205d591b93871b63205ea80f6976b4d76ce23ca95c825d0c74b44e9816c9488ae8022012476dd8a2780028ed3e72ac1f2620580e82a25c22d1c31afca6fb14b125a35c0121030253c73236acf5ea9085d408220141197f6094de07426bd0d32c7a543614fdd7ffffffffb3028cf4ae5b4b6d8f79ab6fc0dd251b28ab28287d33861e35c90f6e5684dba9010000006a4730440220320367535c9bc525c581939b36ebe70dd0845851e68fa9e3cf2d90642bf551b3022055d6fcaef32d9b584eea757fa633c31449f43272d131588ddd87a22d16dd7129012102977a001a0a7bbfd1f8a647c7d46e13e8f6920635b328390b43b3303977101149ffffffff01a02c1000000000001976a91493abf1e9e4a20c125b93f93ee39efc16b6e4bc4688ac00000000'
  ],
  [
    'from', [{
        "txid": "c8beceb964dec7ae5ec6ef5d019429b50c2e5fd07bd369e9a282d5153f23589c",
        "vout": 0,
        "address": "mtymcCX5KixPjT1zxtg59qewBGWptj9etH",
        "account": "",
        "scriptPubKey": "76a91493abf1e9e4a20c125b93f93ee39efc16b6e4bc4688ac",
        "amount": 0.01060000,
    }],
    'to', ['2NEQb8rtiUgxqQ9eif4XVeMUEW2LSZ64s58', 1050000],
    'sign', ['cMh7xdJ5EZVg6kvFsBybwK1EYGJw3G1DHhe5sNPAwbDts94ohKyK'],
    'serialize', '01000000019c58233f15d582a2e969d37bd05f2e0cb52994015defc65eaec7de64b9cebec8000000006a47304402205db94e075d4cf740c69e878fa0079e004bbc323be71b1f8944de702b362ca6880220616e2791168e0a2ffc36dc1847f46b79d7ffb5314ae20ee4066feea2b5a32cdc0121039dbeac2610d53eb7107b14c0fa9be4006a731fa5bcef392d4e1a25ec0e58f0d3ffffffff01900510000000000017a91490edc43da6b052c4a23fc178979ce358a8caad5e8700000000'
  ],
  [
    'from', [{
      "address": "2N6TY8Dc5JmJ87Fg9DhmN66fvFSwnTrjgip",
      "txid": "66e64ef8a3b384164b78453fa8c8194de9a473ba14f89485a0e433699daec140",
      "vout": 0,
      "scriptPubKey": "a91490edc43da6b052c4a23fc178979ce358a8caad5e87",
      "amount": 0.01050000
    }, ['03fd45c8cd28c4c6a9a89b4515173edebc66a2418353976eccf01c73a7da9bbb12', '0349e0138b2c2f496121258e0426e1dbd698b2c6038e70fd17e3563aa87b4384f9'], 2],
    'to', ['mssMdcEm6PiJEr4XZtjk6kkai84EjBbi91', 1040000],
    'sign', [['L3wRFe9XHLnkLquf41F56ac77uRXwJ97HZPQ9tppqyMANBKXpoc5', 'KzkfNSL1gvdyU3CGLaP1Cs3pW167M8r9uE8yMtWQrAzz5vCv59CM']],
    'serialize', '010000000140c1ae9d6933e4a08594f814ba73a4e94d19c8a83f45784b1684b3a3f84ee66600000000d900473044022057c6961adc330ad231f7e1e58f46987637118f85f5f621425a401c609f36abca022017a21edf778d115bab05c70d3c8c4ac16fff52a2686cbb6b60a08b192a5e4e8a01473044022049c8bc0137c49ff87c1c6ef6ef9a7162a64e4519022bd7d68ae523dd6b14c4b2022012f28917b1602d0311ab6c43fa901bf3e5414524252ac85bc9ef8a52d9094210014752210349e0138b2c2f496121258e0426e1dbd698b2c6038e70fd17e3563aa87b4384f92103fd45c8cd28c4c6a9a89b4515173edebc66a2418353976eccf01c73a7da9bbb1252aeffffffff0180de0f00000000001976a914877d4f3be444448f868b345153bc4fc7a11a7c6388ac00000000'
  ],
  [
    'from', [{
      "address": "mgJT8iegL4f9NCgQFeFyfvnSw1Yj4M5Woi",
      "txid": "f50e13cecda9a438ebd7df213a2899e42b2461a18d4630ee773d26b4f2688bdc",
      "vout": 1,
      "scriptPubKey": "76a914089acaba6af8b2b4fb4bed3b747ab1e4e60b496588ac",
      "amount": 0.01
    }],
    'to', ['n3riXZowrjGnY74rx7Hdi9wCyvgyJC28zZ', 990000],
    'sign', ['cPwWtDztEgRCMCU8pMQp4HgphvyadrAsYBrCjXUZuDSmnZkyoyNF'],
    'serialize', '0100000001dc8b68f2b4263d77ee30468da161242be499283a21dfd7eb38a4a9cdce130ef5010000006a4730440220337e09c2729423302abe5e386d5e0f060ae8c006693f87342322bb1fe50065ff0220217a12de44139c57f01d35e988ffe3b0f86005d0cefcecf877b54c67473211d2012103e26b47e7c0d8946954bf9dd4bc7f9e415437eb98271d05f69e78cef8fc6c9a54ffffffff01301b0f00000000001976a914f50f9826ef186074c6fe206cca6b71472ff07ba888ac00000000'
  ]
];
