'use strict';

import chai from 'chai';
import { Utils } from '../src/lib/common';
import { Verifier } from '../src/lib/verifier';
import { Key } from '../src/lib/key';

chai.should();

const aKey = new Key({
  seedData: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  seedType: 'mnemonic'
});

describe('Verifier', function() {
  describe('checkProposalCreation', function() {
    const inputs = [
      {
        txid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        vout: 0,
        satoshis: 6000
      },
      {
        txid: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        vout: 1,
        satoshis: 5000
      }
    ];
    const createProposal = overrides => ({
      outputs: [{
        toAddress: '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA',
        amount: 10000
      }],
      ...overrides
    });
    const checkProposalCreation = (argsOverrides = {}, txpOverrides = {}) => {
      return Verifier.checkProposalCreation(
        createProposal(argsOverrides),
        createProposal(txpOverrides),
        'shared-encrypting-key'
      );
    };

    it('should accept a matching fixed fee and reordered explicit inputs', function() {
      checkProposalCreation(
        { fee: 1000n, inputs },
        {
          fee: '0x3e8',
          inputs: [
            { ...inputs[1], vout: '1', satoshis: '5000' },
            { ...inputs[0], vout: '0', satoshis: '6000' }
          ]
        }
      ).should.be.true;
    });

    it('should reject changed or invalid fixed fees', function() {
      const feePairs = [
        [1000, 1001],
        [-1, -1],
        [1.5, 1.5],
        ['01', '01'],
        ['0x', '0x'],
        ['0xgg', '0xgg']
      ];
      for (const [requestedFee, returnedFee] of feePairs) {
        checkProposalCreation({ fee: requestedFee }, { fee: returnedFee }).should.be.false;
      }
    });

    it('should compare unsafe integer fees using their represented JavaScript value', function() {
      const unsafeFee = Number.MAX_SAFE_INTEGER + 1;

      checkProposalCreation({ fee: unsafeFee }, { fee: unsafeFee }).should.be.true;
      checkProposalCreation({ fee: unsafeFee }, { fee: unsafeFee.toString() }).should.be.true;
      checkProposalCreation({ fee: unsafeFee }, { fee: unsafeFee + 2 }).should.be.false;
    });

    it('should reject changed or invalid explicit inputs', function() {
      const returnedInputSets = [
        [inputs[0]],
        [
          ...inputs,
          {
            txid: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
            vout: 2,
            satoshis: 4000
          }
        ],
        [inputs[0], { ...inputs[1], vout: 2 }],
        [{ ...inputs[0], satoshis: 6001 }, { ...inputs[1], satoshis: 4999 }],
        [inputs[0], inputs[0]]
      ];
      for (const returnedInputs of returnedInputSets) {
        checkProposalCreation({ inputs }, { inputs: returnedInputs }).should.be.false;
      }
    });

    it('should not verify fee or inputs unless explicitly requested', function() {
      checkProposalCreation(
        {},
        {
          fee: 9999,
          inputs: [{
            txid: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
            vout: 3,
            satoshis: 1
          }]
        }
      ).should.be.true;
    });

    it('should treat a null fee as omitted', function() {
      checkProposalCreation(
        { fee: null },
        { fee: 1000 }
      ).should.be.true;
    });

    it('should treat null inputs as omitted', function() {
      checkProposalCreation(
        { inputs: null },
        { inputs }
      ).should.be.true;
    });

    it('should accept matching XRP destination tags', function() {
      checkProposalCreation(
        {
          destinationTag: '12345',
          outputs: [{
            toAddress: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
            amount: 10000,
            tag: 12345
          }]
        },
        {
          destinationTag: 12345,
          outputs: [{
            toAddress: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
            amount: 10000,
            tag: '12345'
          }]
        }
      ).should.be.true;
    });

    it('should reject changed, removed, or injected XRP destination tags', function() {
      const tagPairs = [
        [{ destinationTag: 12345 }, { destinationTag: 54321 }],
        [{ destinationTag: 12345 }, {}],
        [{}, { destinationTag: 12345 }],
        [
          {
            outputs: [{
              toAddress: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
              amount: 10000,
              tag: 12345
            }]
          },
          {
            outputs: [{
              toAddress: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
              amount: 10000,
              tag: 54321
            }]
          }
        ],
        [
          {
            outputs: [{
              toAddress: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
              amount: 10000
            }]
          },
          {
            outputs: [{
              toAddress: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
              amount: 10000,
              tag: 12345
            }]
          }
        ]
      ];

      for (const [requestedTag, returnedTag] of tagPairs) {
        checkProposalCreation(requestedTag, returnedTag).should.be.false;
      }
    });
  });

  describe('checkAddress', function() {
    it('should verify a BTC  address', () => {
      const cred = aKey.createCredentials(null, { coin: 'btc', network: 'livenet', account: 0, n: 1 });
      cred.addWalletInfo('id', 'name', 1, 1, 'copayer');

      Verifier.checkAddress(cred, {
        address: '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA',
        path: 'm/0/0',
        publicKeys: ['03aaeb52dd7494c361049de67cc680e83ebcbbbdbeb13637d92cd845f70308af5e']
      }).should.be.true;
    });

    it('should verify a ETH address', () => {
      const cred = aKey.createCredentials(null, { coin: 'eth', network: 'livenet', account: 0, n: 1 });
      cred.addWalletInfo('id', 'name', 1, 1, 'copayer');

      Verifier.checkAddress(cred, {
        address: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
        path: 'm/0/0',
        publicKeys: ['0237b0bb7a8288d38ed49a524b5dc98cff3eb5ca824c9f9dc0dfdb3d9cd600f299']
      }).should.be.true;
    });

    it('should verify a MATIC address', () => {
      const cred = aKey.createCredentials(null, { coin: 'matic', network: 'livenet', account: 0, n: 1 });
      cred.addWalletInfo('id', 'name', 1, 1, 'copayer');

      Verifier.checkAddress(cred, {
        address: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
        path: 'm/0/0',
        publicKeys: ['0237b0bb7a8288d38ed49a524b5dc98cff3eb5ca824c9f9dc0dfdb3d9cd600f299']
      }).should.be.true;
    });
  });

  describe('checkPrePublishRaw', function() {
    const ATTACKER_EVM = '0x1111111111111111111111111111111111111111';
    const ATTACKER_SOL = 'F7FknkRckx4yvA3Gexnx1H3nwPxndMxVt58BwAzEQhcY';

    const solTxp = (overrides = {}) => ({
      chain: 'sol',
      category: 'transfer',
      from: '8WyoNvKsmfdG6zrbzNBVN8DETyLra3ond61saU9C52YR',
      outputs: [{ toAddress: '3xkNjKm2zvGRvH2z2Nf9Y5hFvHZFtQXbQb1PBxDT56Xy', amount: 3896000000000000 }],
      blockHash: 'GtV1Hb3FvP3HURHAsj8mGwEqCumvP3pv3i6CVCzYNj3d',
      blockHeight: 531575,
      ...overrides
    });

    const evmTxp = (overrides = {}) => ({
      chain: 'eth',
      network: 'livenet',
      outputs: [{ toAddress: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A', amount: 1000 }],
      from: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A',
      nonce: 0,
      gasLimit: 21000,
      gasPrice: 20000000000,
      data: '0x',
      ...overrides
    });

    it('accepts a SOL proposal whose blockhash was refreshed at publish', function() {
      const prePublishRaw = Utils.buildTx(solTxp()).uncheckedSerialize();
      const current = solTxp({ blockHash: 'H1oRr1nfr4b6eZjs9Ssn3bxUmcRAjqRxrbTKuwSPZ9mE', prePublishRaw });
      Verifier.checkPrePublishRaw('sol', current).should.be.true;
    });

    it('rejects a SOL proposal whose destination was tampered', function() {
      const prePublishRaw = Utils.buildTx(solTxp()).uncheckedSerialize();
      const current = solTxp({
        blockHash: 'H1oRr1nfr4b6eZjs9Ssn3bxUmcRAjqRxrbTKuwSPZ9mE',
        outputs: [{ toAddress: ATTACKER_SOL, amount: 3896000000000000 }],
        prePublishRaw
      });
      Verifier.checkPrePublishRaw('sol', current).should.be.false;
    });

    it('rejects an EVM proposal whose destination was tampered', function() {
      const prePublishRaw = Utils.buildTx(evmTxp()).uncheckedSerialize();
      const current = evmTxp({
        nonce: 9,
        outputs: [{ toAddress: ATTACKER_EVM, amount: 1000 }],
        prePublishRaw
      });
      Verifier.checkPrePublishRaw('eth', current).should.be.false;
    });

    it('rejects prePublishRaw on a non-mutable (UTXO) chain', function() {
      Verifier.checkPrePublishRaw('btc', { chain: 'btc', prePublishRaw: 'anything' }).should.be.false;
    });
  });
});
