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
    'serialize', '01000000015884e5db9de218238671572340b207ee85b628074e7e467096c267266baf77a4000000006b4830450221009972100061da4a17a471ac1906c18bb5445c03da2a0be52c59aca6c58f1e342302205eac5ba43830a397f613f40addea4a2eeaa485a1f9a6efa61344c3560762fe3d01210223078d2942df62c45621d209fab84ea9a7a23346201b7727b9b45a29c4e76f5effffffff0150690f00000000001976a9147821c0a3768aa9d1a37e16cf76002aef5373f1a888ac00000000'
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
    'serialize', '0100000001863957ca797bf847eae50f6999e4c3616dc64b1e6661b16d9da2b57d184724e4010000006b483045022100855691c90510edf83ab632f0a0b17f5202d2cf7071050dcf0c2778325ed403cd02207270a2f0b30c13dc3c1dee74b5ccabcc2632b402c4f38adabcd07357df1442270121039dd446bbc85db6917f39c0b4c295b0f8cce76d1926fa76d7b84e3f7ff1c5eec5ffffffff0220a10700000000001976a91448c819246ae5645ceecd41fbe1aa6202a0a9b5ca88ac90b20800000000001976a914aab76ba4877d696590d94ea3e02948b55294815188ac00000000'
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
    'serialize', '0100000002b3028cf4ae5b4b6d8f79ab6fc0dd251b28ab28287d33861e35c90f6e5684dba9000000006a4730440220635e95e1981bbb360feaf4c232f626a0af8eb5c043a99749a21b0e37fd0048fd02207889f6974f0cad39ce8c2a6dff05c8ca402da9ff6fc41e06c12d86853c91a9d80121030253c73236acf5ea9085d408220141197f6094de07426bd0d32c7a543614fdd7ffffffffb3028cf4ae5b4b6d8f79ab6fc0dd251b28ab28287d33861e35c90f6e5684dba9010000006a4730440220319a0b5ee9c67ccb7de4222234f31059354be4f239c99ca24bff30adfec8e8ec022056e6e99e50f7ceaa062958b8424cde1d504019f95c1dc0a0f0778848d0fb9f4b012102977a001a0a7bbfd1f8a647c7d46e13e8f6920635b328390b43b3303977101149ffffffff01a02c1000000000001976a91493abf1e9e4a20c125b93f93ee39efc16b6e4bc4688ac00000000'
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
    'serialize', '01000000019c58233f15d582a2e969d37bd05f2e0cb52994015defc65eaec7de64b9cebec8000000006a473044022050442862e892b1d12bcaa03857746f0ed168122e093d799861f4e081756bb8aa0220081d4eaf9281ae8f954efaeb47500d9a02e5a74b3ada51b6a258ac83c1f4f6420121039dbeac2610d53eb7107b14c0fa9be4006a731fa5bcef392d4e1a25ec0e58f0d3ffffffff01900510000000000017a91490edc43da6b052c4a23fc178979ce358a8caad5e8700000000'
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
    'serialize', '010000000140c1ae9d6933e4a08594f814ba73a4e94d19c8a83f45784b1684b3a3f84ee66600000000da004730440220366678972728684a94f35635b855583603b28065d430949c08be89412a4ee45d02201aa62e3129c8819ecf2048230e8c77e244d6a496f296954a5bb4a0d0185f8c0201483045022100d06f348b4ef793f2bf749b288f1df165c0946779391c50ddc050e5b1608b2dda02200fcc8c6874b9a313374020253c5de346fe3517c97b18bfa769cea1089ad97144014752210349e0138b2c2f496121258e0426e1dbd698b2c6038e70fd17e3563aa87b4384f92103fd45c8cd28c4c6a9a89b4515173edebc66a2418353976eccf01c73a7da9bbb1252aeffffffff0180de0f00000000001976a914877d4f3be444448f868b345153bc4fc7a11a7c6388ac00000000'
  ]
];
