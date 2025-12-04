'use strict';

import chai from 'chai';
import 'chai/register-should';
import { ChainService } from '../../src/lib/chain';
import { ITxProposal, TxProposal } from '../../src/lib/model/txproposal';

const should = chai.should();

const xpub = 'tpubDD7tYYerLNNm65Ez7pRjxQ2NpRHDoyRWoLWudnQ8agXjr7qs9BsPsRXk8Z6spPPJodnaY158YqeCKT5oXuZvbuNLfm1R4kXGJ2vPd9pUxDT';

describe('Chain XRP', function() { 
  describe('#getBitcoreTx', function() {
    it('should create a valid bitcore TX', function() {
      const txp = TxProposal.fromObj(aTXP()) as TxProposal;
      const t = ChainService.getBitcoreTx(txp);
      should.exist(t);
    });

    it('should create a valid signed bitcore TX', function() {
      const txp = TxProposal.fromObj(signedTxp) as TxProposal;
      const t = ChainService.getBitcoreTx(txp);
      should.exist(t);
      // should serialize
      t.uncheckedSerialize().should.deep.equal([
        '12000022800000002400BF209C6140000000000F424068400000000000000A7321024DDE2306BEACF6D450495F40E69400824C99235FECEB742952FBA550C91F9C597446304402206188D1A90328D034F7D01E0ECEB6629AAEF47AF09EF33C4BF91871076AE60C81022056EE1DB7B90B7A701087FA8135E434616C5824F1CCC3FC87F741771E22BE9A138114F1B7FDA196A474A7A5CE0588E03B1BE41F8605978314D51E9EDD6905A6D2FDB4ADD86744C56323439285'
      ]);
    });
  });


  describe('#addSignaturesToBitcoreTx', function() {
    it('should add signatures to an unsigned TX', function() {
      const txp = TxProposal.fromObj(aTXP()) as TxProposal;
      const bitcoreTx = ChainService.getBitcoreTx(txp, { signed: false });
      const signatures = ['304402206188D1A90328D034F7D01E0ECEB6629AAEF47AF09EF33C4BF91871076AE60C81022056EE1DB7B90B7A701087FA8135E434616C5824F1CCC3FC87F741771E22BE9A13'];
      ChainService.addSignaturesToBitcoreTx('xrp', bitcoreTx, null, ['m/0/0'], signatures, xpub, 'ecdsa');
      const signed = bitcoreTx.uncheckedSerialize();
      signed.should.deep.equal([
        '12000022800000002400BF209C6140000000000F424068400000000000000A7321024DDE2306BEACF6D450495F40E69400824C99235FECEB742952FBA550C91F9C597446304402206188D1A90328D034F7D01E0ECEB6629AAEF47AF09EF33C4BF91871076AE60C81022056EE1DB7B90B7A701087FA8135E434616C5824F1CCC3FC87F741771E22BE9A138114F1B7FDA196A474A7A5CE0588E03B1BE41F8605978314D51E9EDD6905A6D2FDB4ADD86744C56323439285'
      ]);
    });

    it('should add signatures to an unsigned TX - backward compatible', function() {
      const txp = TxProposal.fromObj(aTXP()) as TxProposal;
      const bitcoreTx = ChainService.getBitcoreTx(txp, { signed: false });
      const signatures = ['12000022800000002400BF209C6140000000000F424068400000000000000A7321024DDE2306BEACF6D450495F40E69400824C99235FECEB742952FBA550C91F9C597446304402206188D1A90328D034F7D01E0ECEB6629AAEF47AF09EF33C4BF91871076AE60C81022056EE1DB7B90B7A701087FA8135E434616C5824F1CCC3FC87F741771E22BE9A138114F1B7FDA196A474A7A5CE0588E03B1BE41F8605978314D51E9EDD6905A6D2FDB4ADD86744C56323439285'];
      ChainService.addSignaturesToBitcoreTx('xrp', bitcoreTx, null, ['m/0/0'], signatures, xpub, 'ecdsa');
      const signed = bitcoreTx.uncheckedSerialize();
      signed.should.deep.equal([
        '12000022800000002400BF209C6140000000000F424068400000000000000A7321024DDE2306BEACF6D450495F40E69400824C99235FECEB742952FBA550C91F9C597446304402206188D1A90328D034F7D01E0ECEB6629AAEF47AF09EF33C4BF91871076AE60C81022056EE1DB7B90B7A701087FA8135E434616C5824F1CCC3FC87F741771E22BE9A138114F1B7FDA196A474A7A5CE0588E03B1BE41F8605978314D51E9EDD6905A6D2FDB4ADD86744C56323439285'
      ]);
    });
  });

});

const aTXP = function() {
  const txp: ITxProposal = {
    creatorName: '{"iv":"aN+YwTvJRK73M7FfCFzIzA==","v":1,"iter":1,"ks":128,"ts":64,"mode":"ccm","adata":"","cipher":"aes","ct":"TqFvhWq2/F6ykA=="}',
    createdOn: 1763669147,
    id: 'a911faec-975e-4c53-a852-8ebf579ff1f6',
    txid: 'B6BB3DE3F87395619D108DC35E2CC88440C998D854A12E2E312BC5A8DC11F121',
    walletId: '093352fc-a597-4837-94ee-8b9e3f1a5039',
    creatorId: 'c10c8e84ac963c539d86451aea8ce6f92dfaeeebbef1f5dd212d324301ea278f',
    coin: 'xrp',
    chain: 'xrp',
    network: 'testnet',
    message: null,
    payProUrl: null,
    from: 'rPsaG3gUYCPdoN2X1EgynYfYbwKeSbdTCN',
    changeAddress: null,
    escrowAddress: null,
    inputs: [],
    outputs: [{
      amount: 1000000,
      address: 'rLR1cRppAh6PcovPQwZTQd4eT4RApUSYGZ',
      toAddress: 'rLR1cRppAh6PcovPQwZTQd4eT4RApUSYGZ',
      message: null,
      satoshis: 1000000
    }],
    outputOrder: [1, 0],
    walletM: 1,
    walletN: 1,
    requiredSignatures: 1,
    requiredRejections: 1,
    status: 'pending',
    actions: [],
    feeLevel: 'normal',
    feePerKb: 10,
    excludeUnconfirmedUtxos: true,
    addressType: 'P2PKH',
    customData: null,
    amount: '1000000',
    fee: 10,
    version: 3,
    broadcastedOn: 1763669150,
    inputPaths: [],
    proposalSignature: '30440220169536417739cad6db9ef4350e6c0ef38a89cdfe7ad86e856d66e25c85eb156902207aef6136fd53886565b797bf3c1bce8f870c751c71ef74b98d40c462cda2d237',
    proposalSignaturePubKey: null,
    proposalSignaturePubKeySig: null,
    signingMethod: 'ecdsa',
    nonce: 12525724,
    destinationTag: null,
    multiTx: null
  };

  return txp;
};

const signedTxp = {
  creatorName: '{"iv":"aN+YwTvJRK73M7FfCFzIzA==","v":1,"iter":1,"ks":128,"ts":64,"mode":"ccm","adata":"","cipher":"aes","ct":"TqFvhWq2/F6ykA=="}',
  createdOn: 1763669147,
  id: 'a911faec-975e-4c53-a852-8ebf579ff1f6',
  txid: 'B6BB3DE3F87395619D108DC35E2CC88440C998D854A12E2E312BC5A8DC11F121',
  txids: '',
  walletId: '093352fc-a597-4837-94ee-8b9e3f1a5039',
  creatorId: 'c10c8e84ac963c539d86451aea8ce6f92dfaeeebbef1f5dd212d324301ea278f',
  coin: 'xrp',
  chain: 'xrp',
  network: 'testnet',
  message: '',
  payProUrl: '',
  from: 'rPsaG3gUYCPdoN2X1EgynYfYbwKeSbdTCN',
  changeAddress: '',
  escrowAddress: '',
  inputs: [],
  outputs: [{
    amount: 1000000,
    toAddress: 'rLR1cRppAh6PcovPQwZTQd4eT4RApUSYGZ',
    message: '',
    satoshis: 1000000
  }],
  outputOrder: [1, 0],
  walletM: 1,
  walletN: 1,
  requiredSignatures: 1,
  requiredRejections: 1,
  status: 'broadcasted',
  actions: [
    {
      version: '1.0.0',
      createdOn: 1763669149,
      copayerId: 'c10c8e84ac963c539d86451aea8ce6f92dfaeeebbef1f5dd212d324301ea278f',
      type: 'accept',
      signatures: [
        '12000022800000002400BF209C6140000000000F424068400000000000000A7321024DDE2306BEACF6D450495F40E69400824C99235FECEB742952FBA550C91F9C597446304402206188D1A90328D034F7D01E0ECEB6629AAEF47AF09EF33C4BF91871076AE60C81022056EE1DB7B90B7A701087FA8135E434616C5824F1CCC3FC87F741771E22BE9A138114F1B7FDA196A474A7A5CE0588E03B1BE41F8605978314D51E9EDD6905A6D2FDB4ADD86744C56323439285'
      ],
      xpub: 'tpubDD7tYYerLNNm65Ez7pRjxQ2NpRHDoyRWoLWudnQ8agXjr7qs9BsPsRXk8Z6spPPJodnaY158YqeCKT5oXuZvbuNLfm1R4kXGJ2vPd9pUxDT',
      comment: '',
      copayerName: '{"iv":"aN+YwTvJRK73M7FfCFzIzA==","v":1,"iter":1,"ks":128,"ts":64,"mode":"ccm","adata":"","cipher":"aes","ct":"TqFvhWq2/F6ykA=="}'
    }
  ],
  feeLevel: 'normal',
  feePerKb: 10,
  excludeUnconfirmedUtxos: true,
  addressType: 'P2PKH',
  customData: '',
  amount: 1000000,
  fee: 10,
  version: 3,
  broadcastedOn: 1763669150,
  inputPaths: [],
  proposalSignature: '30440220169536417739cad6db9ef4350e6c0ef38a89cdfe7ad86e856d66e25c85eb156902207aef6136fd53886565b797bf3c1bce8f870c751c71ef74b98d40c462cda2d237',
  proposalSignaturePubKey: '',
  proposalSignaturePubKeySig: '',
  signingMethod: 'ecdsa',
  lowFees: '',
  raw: [
    '12000022800000002400BF209C6140000000000F424068400000000000000A7321024DDE2306BEACF6D450495F40E69400824C99235FECEB742952FBA550C91F9C597446304402206188D1A90328D034F7D01E0ECEB6629AAEF47AF09EF33C4BF91871076AE60C81022056EE1DB7B90B7A701087FA8135E434616C5824F1CCC3FC87F741771E22BE9A138114F1B7FDA196A474A7A5CE0588E03B1BE41F8605978314D51E9EDD6905A6D2FDB4ADD86744C56323439285'
  ],
  nonce: 12525724,
  gasPrice: '',
  maxGasFee: '',
  priorityGasFee: '',
  txType: '',
  gasLimit: '',
  data: '',
  tokenAddress: '',
  multisigContractAddress: '',
  multisigTxId: '',
  destinationTag: '',
  invoiceID: '',
  lockUntilBlockHeight: '',
  instantAcceptanceEscrow: '',
  isTokenSwap: '',
  multiSendContractAddress: '',
  enableRBF: '',
  replaceTxByFee: '',
  multiTx: '',
  space: '',
  nonceAddress: '',
  blockHash: '',
  blockHeight: '',
  category: '',
  priorityFee: '',
  computeUnits: '',
  memo: '',
  fromAta: '',
  decimals: '',
  refreshOnPublish: '',
  prePublishRaw: '',
  note: '',
  derivationStrategy: 'BIP44',
  isPending: false
};
