'use strict';

const _ = require('lodash');
const chai = require('chai');
const should = chai.should();
const { BitcoreLibLtc } = require('crypto-wallet-core');
const { ChainService } = require('../../ts_build/lib/chain');
const { LtcChain } = require('../../ts_build/lib/chain/ltc');
const { TxProposal } = require('../../ts_build/lib/model/txproposal');

const Common = require('../../ts_build/lib/common');
const Constants = Common.Constants;

describe('Chain LTC', () => {
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
      t.serialize().should.equal('0100000001c8b99fd72001d477bf86fdc43b0288d42f148d15256848ad781b97ede6bfc33a010000006a47304402203af47006767a8a1d6febb705532bf7df28fc2322a0e2a7dfb63f2ea4b521adc002204ca0cf1eb33110de23d419411a3ea25a32aed2d16c3ea7ad4fff8abf8f409c32012103085a76aa44f4df633be85f914cdbd9cbf9c15c2428d89fa3229be321b08c7421ffffffff02b2180200000000001976a9143fe51182dc2c1871ae2ddce6d8620fcc54d976f388ac10270000000000001976a914942b7b6270ee1604818c3d828fb9144dfe3663be88ac00000000');
      t.isFullySigned().should.equal(true);
    });

    it('should create a valid unsigned bitcore TX', () => {
      const txp = TxProposal.fromObj(signedTxp);
      const t = ChainService.getBitcoreTx(txp, { signed: false } );
      should.exist(t);

      // should serialized
      (() => { return t.serialize(); }).should.throw('not been fully signed');

      t.uncheckedSerialize().should.equal('0100000001c8b99fd72001d477bf86fdc43b0288d42f148d15256848ad781b97ede6bfc33a0100000000ffffffff02b2180200000000001976a9143fe51182dc2c1871ae2ddce6d8620fcc54d976f388ac10270000000000001976a914942b7b6270ee1604818c3d828fb9144dfe3663be88ac00000000');
      t.isFullySigned().should.equal(false);
    });
  });

  describe('#getEstimatedSize', () => {
    let ltc, fromAddress, simpleUtxoWith1LTC, changeAddress, toAddress, privateKey;

    before(() =>  {
      ltc = new LtcChain();
      fromAddress = 'LcA1gPGGxYEGL2FS1eErMnWKSCkPUJonxH';
      toAddress = 'LYNk38CXCPavnf3wmhkymkC9HVrXj6zMQn';
      changeAddress = 'LLMoDN22Jhyuy3C5VrwuRfmmQEAxyFhsyd';
      privateKey = 'T4EAFWF8i3vFtgXW8nwRQWgSo2E3VEp5D3vbv27umAjUCQQrsqFQ';
      simpleUtxoWith1LTC = {
        address: fromAddress,
        txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
        outputIndex: 0,
        script: BitcoreLibLtc.Script.buildPublicKeyHashOut(fromAddress).toString(),
        satoshis: 1e8,
      };

      const privKey = new BitcoreLibLtc.PrivateKey();
    });

    it('1 input p2pkh,1 output p2pkh: Margin should be 10%', () => {
      let x = TxProposal.fromObj(aTXP());
      delete x.changeAddress;
      x.outputs.pop();
      x.addressType = Constants.SCRIPT_TYPES.P2PKH;
      const estimatedLength = ltc.getEstimatedSize(x);

      // Create a similar TX.
      let tx = new BitcoreLibLtc.Transaction();
      tx.from(simpleUtxoWith1LTC)
        .to([{ address: toAddress, satoshis: 1e8 - 7000 }])
        .sign(privateKey);

      const actualLength = tx.serialize().length / 2;

      // Check margin is ~0.0
      ((Math.abs(actualLength-estimatedLength))/actualLength).should.not.be.above(0.05);
    });

    const p2shPrivateKey1 = BitcoreLibLtc.PrivateKey.fromWIF('T4EAFWF8i3vFtgXW8nwRQWgSo2E3VEp5D3vbv27umAjUCQQrsqFQ');
    const p2shPublicKey1 = p2shPrivateKey1.toPublicKey();
    const p2shPrivateKey2 = BitcoreLibLtc.PrivateKey.fromWIF('T4PcE9qqC9UNhB5Xb694epiXXEYW6xp6aA8QHT4UB83UfcDVicew');
    const p2shPublicKey2 = p2shPrivateKey2.toPublicKey();

    const p2shAddress = BitcoreLibLtc.Address.createMultisig([
      p2shPublicKey1,
      p2shPublicKey2,
    ], 2, 'testnet');
    const p2shUtxoWith1BTC = {
      address: p2shAddress.toString(),
      txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
      outputIndex: 0,
      script: BitcoreLibLtc.Script(p2shAddress).toString(),
      satoshis: 1e8
    };

    it('1 input p2sh, 2 P2PKH outputs: ', () => {
      let x = TxProposal.fromObj(aTXP());

      // Create a similar TX.
      let tx = new BitcoreLibLtc.Transaction();
      tx.from(p2shUtxoWith1BTC, [p2shPublicKey1, p2shPublicKey2], 2)
        .to([{ address: toAddress, satoshis: 1e7 }, { address: toAddress, satoshis: 1e6 }])
        .change(changeAddress)
        .sign(p2shPrivateKey1)
        .sign(p2shPrivateKey2);
      const estimatedLength = ltc.getEstimatedSize(x);

      const actualLength = tx.serialize().length / 2;
      ((Math.abs(actualLength-estimatedLength))/actualLength).should.be.below(0.05);
    });

    it('1 input p2wpkh, 1 Native Segwit output: ', () => {
      let x = TxProposal.fromObj(aTXP());

      // just to force the desired calculation
      x.addressType = Constants.SCRIPT_TYPES.P2WPKH;

      x.outputs[0].toAddress = 'LU8DsGPyFtgq3nZGHR3twfGsVUZ8nWAbSq';
      x.outputs.pop();
      delete x.changeAddress;
      const estimatedLength = ltc.getEstimatedSize(x);

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
      const estimatedLength = ltc.getEstimatedSize(x);

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
    'coin': 'ltc',
    'network': 'livenet',
    'amount': 30000000,
    'message': 'some message',
    'proposalSignature': '7035022100896aeb8db75fec22fddb5facf791927a996eb3aee23ee6deaa15471ea46047de02204c0c33f42a9d3ff93d62738712a8c8a5ecd21b45393fdd144e7b01b5a186f1f9',
    'changeAddress': {
      'version': '1.0.0',
      'createdOn': 1424372337,
      'address': 'LLMoDN22Jhyuy3C5VrwuRfmmQEAxyFhsyd',
      'path': 'm/2147483647/1/0',
      'publicKeys': [
        '030562cb099e6043dc499eb359dd97c9d500a3586498e4bcf0228a178cc20e6f16',
        '0367027d17dbdfc27b5e31f8ed70e14d47949f0fa392261e977db0851c8b0d6fac',
        '0315ae1e8aa866794ae603389fb2b8549153ebf04e7cdf74501dadde5c75ddad11'
      ]
    },
    'inputs': [{
      'txid': '6ee699846d2d6605f96d20c7cc8230382e5da43342adb11b499bbe73709f06ab',
      'vout': 8,
      'satoshis': 100000000,
      'scriptPubKey': 'a914a8a9648754fbda1b6c208ac9d4e252075447f36887',
      'address': 'LcA1gPGGxYEGL2FS1eErMnWKSCkPUJonxH',
      'path': 'm/2147483647/0/1',
      'publicKeys': ['0319008ffe1b3e208f5ebed8f46495c056763f87b07930a7027a92ee477fb0cb0f', '03b5f035af8be40d0db5abb306b7754949ab39032cf99ad177691753b37d101301']
    }],
    'inputPaths': ['m/2147483647/0/1'],
    'requiredSignatures': 2,
    'requiredRejections': 1,
    'walletN': 2,
    'addressType': 'P2SH',
    'status': 'pending',
    'actions': [],
    'fee': 10000,
    'outputs': [{
      'toAddress': 'LYNk38CXCPavnf3wmhkymkC9HVrXj6zMQn',
      'amount': 10000000,
      'message': 'first message'
    }, {
      'toAddress': 'LU8DsGPyFtgq3nZGHR3twfGsVUZ8nWAbSq',
      'amount': 20000000,
      'message': 'second message'
    }, ],
    'outputOrder': [0, 1, 2]
  };

  return txp;
};

const signedTxp = {
  actions: [
    {
      'version': '1.0.0',
      'createdOn': 1626385821,
      'copayerId': '16f48373387600f00741e74488da2f82409e82105f515e6c7a856368cc95fc78',
      'type': 'accept',
      'signatures': [
        '304402203af47006767a8a1d6febb705532bf7df28fc2322a0e2a7dfb63f2ea4b521adc002204ca0cf1eb33110de23d419411a3ea25a32aed2d16c3ea7ad4fff8abf8f409c32'
      ],
      'xpub': 'tpubDDgwMabfeMxmyFfiNUykhtdsCSHakHT7mc5EN3xEf3pMroYLzBhZ5U4tPH3nU38CXXSYbwzVjgmVoivieefpQ6P37hhjpM37hgZTu4ujv6N',
      'comment': null,
      'copayerName': 'Ben'
    }
  ],
  version: 3,
  createdOn: 1626385821,
  id: 'b89d4f4b-0c36-4054-8e09-0d3867f1fc89',
  walletId: '10f76944-ac95-494a-ba32-1eba9a581332',
  creatorId: '16f48373387600f00741e74488da2f82409e82105f515e6c7a856368cc95fc78',
  coin: 'ltc',
  chain: 'ltc',
  network: 'testnet',
  outputs: [
    {
      amount: 10000,
      toAddress: 'mu2QPdDVzsuAJAcMKbhqWqZYfeWcAonGEf',
      message: null,
      encryptedMessage: null
    }
  ],
  amount: 10000,
  message: 'test',
  payProUrl: null,
  changeAddress: {
    version: '1.0.0',
    createdOn: 1626385821,
    address: 'mmLoH6EPi24GVPngf1iFhVdQ7p2D37dxRM',
    walletId: '10f76944-ac95-494a-ba32-1eba9a581332',
    isChange: true,
    path: 'm/1/3',
    publicKeys:
      [ '03c27ea129d08ada3eb68235f9422230d8d0234511599ba1b9b91b2d1d82cc8e22' ],
    coin: 'ltc',
    network: 'testnet',
    type: 'P2PKH',
    beRegistered: null
  },
  inputs: [
    {
      address: 'my9tKKW7Fxwad2UcCibV3pagJcxq2BJ4Bz',
      satoshis: 150000,
      amount: 0.0015,
      scriptPubKey: '76a914c1763545cd6afa8e8e33fafc2039167d47d07a8188ac',
      txid: '3ac3bfe6ed971b78ad486825158d142fd488023bc4fd86bf77d40120d79fb9c8',
      vout: 1,
      locked: false,
      confirmations: 1
    }
  ],
  walletM: 1,
  walletN: 1,
  requiredSignatures: 1,
  requiredRejections: 1,
  status: 'temporary',
  txid: undefined,
  broadcastedOn: undefined,
  inputPaths: [ 'm/0/0' ],
  outputOrder: [ 1, 0 ],
  fee: 2606,
  feeLevel: 'normal',
  feePerKb: 11378,
  excludeUnconfirmedUtxos: false,
  addressType: 'P2PKH',
  customData: undefined,
  proposalSignature: undefined,
  signingMethod: 'ecdsa',
  proposalSignaturePubKey: undefined,
  proposalSignaturePubKeySig: undefined,
  lockUntilBlockHeight: undefined,
  gasPrice: undefined,
  from: undefined,
  nonce: null,
  gasLimit: undefined,
  data: undefined,
  tokenAddress: undefined,
  isTokenSwap: null,
  multisigContractAddress: undefined,
  multisigTxId: undefined,
  destinationTag: undefined,
  invoiceID: undefined,
  isPending: false
};
