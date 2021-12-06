'use strict';

const  _ = require('lodash');
const chai = require('chai');
const should = chai.should();
const { BitcoreLibDoge } = require ('crypto-wallet-core');
const { ChainService } = require('../../ts_build/lib/chain');
const { DogeChain } = require('../../ts_build/lib/chain/doge');
const { TxProposal } = require('../../ts_build/lib/model/txproposal');

const Common = require('../../ts_build/lib/common');
const Constants = Common.Constants;

describe('Chain DOGE', () => {
  describe('#getBitcoreTx', () => {
    it('should create a valid bitcore TX', () => {
      const txp = TxProposal.fromObj(aTXP());
      const t = ChainService.getBitcoreTx(txp);
      should.exist(t);
    });
    it('should order outputs as specified by outputOrder', () => {
      const txp = TxProposal.fromObj(aTXP());

      txp.outputOrder = [0, 1, 2];
      const t = ChainService.getBitcoreTx(txp);
      t.getChangeOutput().should.deep.equal(t.outputs[2]);

      txp.outputOrder = [2, 0, 1];
      const t2 = ChainService.getBitcoreTx(txp);
      t2.getChangeOutput().should.deep.equal(t2.outputs[0]);
    });

    it('should create a valid signed bitcore TX', () => {
      const txp = TxProposal.fromObj(signedTxp);
      const t = ChainService.getBitcoreTx(txp);
      should.exist(t);

      // should serialized
      t.serialize().should.equal('0100000001b8a1d4773add3d5ca38652537310e9bd64d812d771e16f62b4a6e33e79f85453000000006b483045022100a9bee101f13eeb8f6bdf1b6421974a17b2aeb0bcf080526df20e93483a67bbca022071ba69e707430136fb65488b1e5413eb54279770b74b7e15fe15aeac16770ceb012102f4526941f57f37b8f1cd4970091ebcd1701980a82d26a781b2e44b384609eb22ffffffff026c81c9f6160900001976a914aeb332ea003a7efb5dab0dcc56d19fed84e26afb88acf4cb5156010000001976a914afbf96bfb28815cad8205c8f2f5a86819136664c88ac00000000');
      t.isFullySigned().should.equal(true);
    });

    it('should create a valid unsigned bitcore TX', () => {
      const txp = TxProposal.fromObj(signedTxp);
      const t = ChainService.getBitcoreTx(txp, { signed: false } );
      should.exist(t);

      // should serialized
      (() => { return t.serialize(); }).should.throw('not been fully signed');

      t.uncheckedSerialize().should.equal('0100000001b8a1d4773add3d5ca38652537310e9bd64d812d771e16f62b4a6e33e79f854530000000000ffffffff026c81c9f6160900001976a914aeb332ea003a7efb5dab0dcc56d19fed84e26afb88acf4cb5156010000001976a914afbf96bfb28815cad8205c8f2f5a86819136664c88ac00000000');
      t.isFullySigned().should.equal(false);
    });
  });

  describe('#getEstimatedSize', () => {
    let doge, fromAddress, simpleUtxo, changeAddress, toAddress, privateKey;

    before(() => {
      doge = new DogeChain();
      fromAddress = 'D9w9sRrMYictva4me78h3EsivKdsYUffY3';
      toAddress = 'DCcS6pGDLUfXZSxQEMKJgmBjYNRcW4wuo4';
      changeAddress = 'D7J3Mqji3bfPKMXoSmaCQtk7nhLULaNmUM';
      privateKey = 'QWL2M3x4s8LVroDNZu3jFnWmTSVDL8RtgKvc7Uj1VasHdPeisD1o';
      simpleUtxo = {
        address: fromAddress,
        txId: '0820f0d4aafe9f142d18c6400ed3d58af5f0834b4b05ae41b3adbef61d6b7e1b',
        outputIndex: 0,
        script: BitcoreLibDoge.Script.buildPublicKeyHashOut(fromAddress).toString(),
        satoshis: 1e9,
      };

      const privKey = new BitcoreLibDoge.PrivateKey();
    });

    it('1 input p2pkh,1 output p2pkh: Margin should be 10%', () => {
      let x = TxProposal.fromObj(aTXP());
      delete x.changeAddress;
      x.outputs.pop();
      x.addressType = Constants.SCRIPT_TYPES.P2PKH;
      const estimatedLength = doge.getEstimatedSize(x);

      // Create a similar TX.
      let tx = new BitcoreLibDoge.Transaction();
      tx.from(simpleUtxo)
        .to([{ address: toAddress, satoshis: 1e9 - 1e8 }])
        .sign(privateKey);

      const actualLength = tx.serialize().length/2;

      // Check margin is ~0.0
      ((Math.abs(actualLength-estimatedLength))/actualLength).should.not.be.above(0.05);
    });

    const p2shPrivateKey1 = BitcoreLibDoge.PrivateKey.fromWIF('QQu6YLUqhPdHSGDyPWk1nB3225NTpMg9HE6eecFmE4169dTjtxjX');
    const p2shPublicKey1 = p2shPrivateKey1.toPublicKey();
    const p2shPrivateKey2 = BitcoreLibDoge.PrivateKey.fromWIF('QQrWAEuSPk8TZF9rakoHGNiKmmhzshSEYkRp2J59TrhCXTkraP65');
    const p2shPublicKey2 = p2shPrivateKey2.toPublicKey();

    const p2shAddress = BitcoreLibDoge.Address.createMultisig([
      p2shPublicKey1,
      p2shPublicKey2,
    ], 2, 'testnet');
    const p2shUtxoWithDOGE = {
      address: p2shAddress.toString(),
      txId: '0820f0d4aafe9f142d18c6400ed3d58af5f0834b4b05ae41b3adbef61d6b7e1b',
      outputIndex: 0,
      script: BitcoreLibDoge.Script(p2shAddress).toString(),
      satoshis: 3e9
    };

    it('1 input p2sh, 2 P2PKH outputs: ', () => {
      let x = TxProposal.fromObj(aTXP());

      // Create a similar TX.
      let tx = new BitcoreLibDoge.Transaction();
      tx.from(p2shUtxoWithDOGE, [p2shPublicKey1, p2shPublicKey2], 2)
        .to([{ address: toAddress, satoshis: 1e9 }, { address: toAddress, satoshis: 2e8 }])
        .change(changeAddress)
        .sign(p2shPrivateKey1)
        .sign(p2shPrivateKey2);
      const estimatedLength = doge.getEstimatedSize(x);

      const actualLength = tx.serialize().length / 2;
      ((Math.abs(actualLength-estimatedLength))/actualLength).should.be.below(0.05);
    });

    it('1 input p2wpkh, 1 Native Segwit output: ', () => {
      let x = TxProposal.fromObj(aTXP());

      // just to force the desired calculation
      x.addressType = Constants.SCRIPT_TYPES.P2WPKH;

      x.outputs[0].toAddress = 'DGMBDFnEDepajnZZNS8F6WC3BjTLMyaLCo';
      x.outputs.pop();
      delete x.changeAddress;
      const estimatedLength = doge.getEstimatedSize(x);

      // https://bitcoin.stackexchange.com/questions/84004/how-do-virtual-size-stripped-size-and-raw-size-compare-between-legacy-address-f
      const actualLength = 437 / 4; // this is the vsize
      ((Math.abs(actualLength-estimatedLength))/actualLength).should.be.below(0.05);
    });

    it('2 input multisig p2wsh, 1 native segwit output: ', () => {
      let x = TxProposal.fromObj(aTXP());
      x.addressType = Constants.SCRIPT_TYPES.P2WSH;
      x.outputs[0].toAddress = toAddress;
      delete x.changeAddress;
      x.outputs.pop();
      const estimatedLength = doge.getEstimatedSize(x);

      // from https://bitcoin.stackexchange.com/questions/88226/how-to-calculate-the-size-of-multisig-transaction
      const actualLength = (346 + 2 * 108) / 4; // this is the vsize
      ((Math.abs(actualLength-estimatedLength))/actualLength).should.be.below(0.05);
    });
  });
});

const aTXP = () => {
  const txp = {
    'version': 3,
    'createdOn': 1423146231,
    'id': '75c34f49-1ed6-255f-e9fd-0c71ae75ed1e',
    'walletId': '1',
    'creatorId': '1',
    'coin': 'doge',
    'network': 'livenet',
    'amount': 1.2550574e14,
    'message': 'some message',
    'proposalSignature': '304402207e8ba2f9e88c1e7a76979f7e9df4d1cf43784d196b4b92f7f605386d0562216c022025356aae37397771a5fcb7520e97096fed197598a0e68883f6b30f3ccddd636c',
    'changeAddress': {
      'version': '1.0.0',
      'createdOn': 1424372337,
      'address': 'D7J3Mqji3bfPKMXoSmaCQtk7nhLULaNmUM',
      'path': 'm/2147483647/1/0',
      'publicKeys': [
        '030562cb099e6043dc499eb359dd97c9d500a3586498e4bcf0228a178cc20e6f16',
        '0367027d17dbdfc27b5e31f8ed70e14d47949f0fa392261e977db0851c8b0d6fac',
        '0315ae1e8aa866794ae603389fb2b8549153ebf04e7cdf74501dadde5c75ddad11'
      ]
    },
    'inputs': [
      {
        'txid': '0820f0d4aafe9f142d18c6400ed3d58af5f0834b4b05ae41b3adbef61d6b7e1b',
        'vout': 8,
        'satoshis': 1.2550574e14,
        'scriptPubKey': 'a914a8a9648754fbda1b6c208ac9d4e252075447f36887',
        'address': 'D9w9sRrMYictva4me78h3EsivKdsYUffY3',
        'path': 'm/2147483647/0/1',
        'publicKeys': [
          '0319008ffe1b3e208f5ebed8f46495c056763f87b07930a7027a92ee477fb0cb0f',
          '03b5f035af8be40d0db5abb306b7754949ab39032cf99ad177691753b37d101301'
        ]
      }
    ],
    'inputPaths': ['m/2147483647/0/1'],
    'requiredSignatures': 2,
    'requiredRejections': 1,
    'walletN': 2,
    'addressType': 'P2SH',
    'status': 'pending',
    'actions': [],
    'fee': 665600000,
    'outputs': [
      {
        'toAddress': 'DKdkvdJfQwQmnT9Hvq1CdB9kzsy76f1Qsd',
        'amount': 7770000000000,
        'message': 'first message'
      }, {
        'toAddress': 'DL2EGukahtib57Sg7FtHsvf8HgwMJtbBA3',
        'amount': 47805070468192,
        'message': 'second message'
      },
    ],
    'outputOrder': [0, 1, 2]
  };

  return txp;
};

const signedTxp = {
  'actions': [
    {
      'version': '1.0.0',
      'createdOn': 1621538686,
      'copayerId': '5a49148ea402f06943b511912f31bc9114153e6055c38642fe789f7b2c7bf9f8',
      'type': 'accept',
      'signatures': [
        '3045022100a9bee101f13eeb8f6bdf1b6421974a17b2aeb0bcf080526df20e93483a67bbca022071ba69e707430136fb65488b1e5413eb54279770b74b7e15fe15aeac16770ceb'
      ],
      'xpub': 'tpubDDtorxcvdjDwsYDCkSUTigtBGh1N5EjrDCqWwkCEz69cBHCh2mZoHxdfQzaZBd7tN5vsUxSchDxxGYxEQrbkyeUr4iWQJ89tTKgZpgivS8P',
      'comment': null,
      'copayerName': 'copayer 1'
    }
  ],
  'version': 3,
  'createdOn': 1621538640,
  'id': 'B8Frw4L4mTZumUx5D1heVg',
  'walletId': 'd98853c7-5a4b-48de-9f6c-8fb36aa271f1',
  'creatorId': '5a49148ea402f06943b511912f31bc9114153e6055c38642fe789f7b2c7bf9f8',
  'coin': 'doge',
  'network': 'testnet',
  'outputs': [
    {
      'amount': 5743168500,
      'toAddress': 'mwYE4TAQQF4F8aRZCVG8YXQDpuFRfjh3Mg',
      'message': null
    }
  ],
  'amount': 5743168500,
  'message': 'some message',
  'payProUrl': null,
  'changeAddress': {
    'version': '1.0.0',
    'createdOn': 1621538640,
    'address': 'mwSgYPXVExR1BCL72SCmh2nSDrsGX2bssj',
    'walletId': 'd98853c7-5a4b-48de-9f6c-8fb36aa271f1',
    'isChange': true,
    'path': 'm/1/0',
    'publicKeys': [
      '0392e5436961b4301a54fedab9b28ff70e9d90620304d93b07a1631be0d5e75084'
    ],
    'coin': 'doge',
    'network': 'testnet',
    'type': 'P2PKH',
    'hasActivity': null,
    'beRegistered': null
  },
  'inputs': [
    {
      'address': 'n1Y8s9bFx693pnf8A5v2YR5QbbR4N6e89Q',
      'satoshis': 10000000000000,
      'amount': 100000,
      'scriptPubKey': '76a914db9bc16a822e747bdf681bb732bda92fd8fac4bf88ac',
      'txid': '5354f8793ee3a6b4626fe171d712d864bde91073535286a35c3ddd3a77d4a1b8',
      'vout': 0,
      'locked': false,
      'confirmations': 11,
      'path': 'm/0/8',
      'publicKeys': [
        '02f4526941f57f37b8f1cd4970091ebcd1701980a82d26a781b2e44b384609eb22'
      ]
    }
  ],
  'walletM': 1,
  'walletN': 1,
  'requiredSignatures': 1,
  'requiredRejections': 1,
  'status': 'broadcasted',
  'txid': '5b0e1d4eaa939bb219e7f054c24dda8e1a0bca392c108ed3017f84c82f13ae97',
  'broadcastedOn': 1621538687,
  'inputPaths': [
    'm/0/8'
  ],
  'outputOrder': [
    1,
    0
  ],
  'fee': 22500000,
  'feeLevel': 'normal',
  'feePerKb': 100000000,
  'excludeUnconfirmedUtxos': true,
  'addressType': 'P2PKH',
  'customData': null,
  'proposalSignature': '3044022025f2b5b1da1c45c4103a21448be4e1095acd908629acc89dc3398fa0d4621a2302206b809ffff1a896c367a9ba35fb2c100f187ab73c4ee590ba4aff778a91ee9ee3',
  'signingMethod': 'ecdsa',
  'proposalSignaturePubKey': null,
  'proposalSignaturePubKeySig': null,
  'lockUntilBlockHeight': null,
  'gasPrice': null,
  'from': null,
  'nonce': null,
  'gasLimit': null,
  'data': null,
  'tokenAddress': null,
  'multisigContractAddress': null,
  'multisigTxId': null,
  'destinationTag': null,
  'invoiceID': null,
  'derivationStrategy': 'BIP44',
  'creatorName': 'copayer 1',
  'raw': '0100000001b8a1d4773add3d5ca38652537310e9bd64d812d771e16f62b4a6e33e79f85453000000006b483045022100a9bee101f13eeb8f6bdf1b6421974a17b2aeb0bcf080526df20e93483a67bbca022071ba69e707430136fb65488b1e5413eb54279770b74b7e15fe15aeac16770ceb012102f4526941f57f37b8f1cd4970091ebcd1701980a82d26a781b2e44b384609eb22ffffffff026c81c9f6160900001976a914aeb332ea003a7efb5dab0dcc56d19fed84e26afb88acf4cb5156010000001976a914afbf96bfb28815cad8205c8f2f5a86819136664c88ac00000000',
  'note': null,
  'isPending': false
};
