'use strict';

import chai from 'chai';
import sinon from 'sinon';
import { Verifier } from '../src/lib/verifier';
import { Key } from '../src/lib/key';
import log from '../src/lib/log';

chai.should();

const aKey = new Key({
  seedData: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  seedType: 'mnemonic'
});

describe('Verifier', function() {
  describe('checkPaypro', function() {
    const amount = 10000;
    const addresses = {
      btc: [
        '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA',
        '1BoatSLRHtKNngkdXEeobR76b53LETtpyT'
      ],
      bch: {
        cashaddr: 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        legacy: 'CTH8H8Zj6DSnXFBKQeDG28ogAS92iS16Bp',
        different: 'bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy'
      },
      doge: [
        'DBtUjAUFWHqS1y8CgetQtPW6YKDhffyFT4',
        'D77Z1nmgSZxJTmtN65n2MVF9yvLSB4MpiC'
      ],
      ltc: [
        'LQqWdV81RmiEzXoACvWDQPZEXXU1Q16suH',
        'Lcyaicjq2aFgcgRX5mDhhQkXN8RFvzWowa'
      ]
    };
    const supportedChains = ['btc', 'bch', 'doge', 'ltc'];
    const addressFor = chain => chain === 'bch' ? addresses.bch.cashaddr : addresses[chain][0];
    const differentAddressFor = chain => chain === 'bch' ? addresses.bch.different : addresses[chain][1];
    const createTxp = (chain, overrides = {}) => ({
      version: 3,
      chain,
      coin: chain,
      amount,
      outputs: [{ toAddress: addressFor(chain), amount }],
      ...overrides
    });
    const createPaypro = (chain, overrides = {}) => ({
      instructions: [{ toAddress: addressFor(chain), amount }],
      ...overrides
    });

    const matchingCases = [
      {
        description: 'accepts matching BTC PayPro destination and amount',
        chain: 'btc'
      },
      {
        description: 'accepts matching DOGE PayPro destination and amount',
        chain: 'doge'
      },
      {
        description: 'accepts matching LTC PayPro destination and amount',
        chain: 'ltc'
      }
    ];
    for (const testCase of matchingCases) {
      it(testCase.description, function() {
        Verifier.checkPaypro(
          createTxp(testCase.chain),
          createPaypro(testCase.chain)
        ).should.equal(true);
      });
    }

    const destinationMismatchCases = [
      {
        description: 'rejects a BTC PayPro destination mismatch with the correct amount',
        chain: 'btc'
      },
      {
        description: 'rejects a DOGE PayPro destination mismatch with the correct amount',
        chain: 'doge'
      },
      {
        description: 'rejects an LTC PayPro destination mismatch with the correct amount',
        chain: 'ltc'
      }
    ];
    for (const testCase of destinationMismatchCases) {
      it(testCase.description, function() {
        const paypro = createPaypro(testCase.chain, {
          instructions: [{
            toAddress: differentAddressFor(testCase.chain),
            amount
          }]
        });
        Verifier.checkPaypro(createTxp(testCase.chain), paypro).should.equal(false);
      });
    }

    it('accepts equivalent BCH cashaddr and legacy destinations', function() {
      const txp = createTxp('bch', {
        outputs: [{ toAddress: addresses.bch.legacy, amount }]
      });
      Verifier.checkPaypro(txp, createPaypro('bch')).should.equal(true);
    });

    it('rejects a different BCH PayPro destination with the correct amount', function() {
      const paypro = createPaypro('bch', {
        instructions: [{ toAddress: addresses.bch.different, amount }]
      });
      Verifier.checkPaypro(createTxp('bch'), paypro).should.equal(false);
    });

    it('rejects an amount mismatch for every supported multisig chain', function() {
      for (const chain of supportedChains) {
        const paypro = createPaypro(chain, {
          instructions: [{ toAddress: addressFor(chain), amount: amount + 1 }]
        });
        chai.expect(Verifier.checkPaypro(createTxp(chain), paypro), chain).to.equal(false);
      }
    });

    it('rejects an unsupported chain instead of accepting it by default', function() {
      const txp = createTxp('btc', { chain: 'eth' });
      Verifier.checkPaypro(txp, createPaypro('btc')).should.equal(false);
    });

    it('rejects missing transaction or PayPro data without throwing', function() {
      const cases = [
        { txp: null, paypro: createPaypro('btc') },
        { txp: createTxp('btc'), paypro: null }
      ];
      for (const testCase of cases) {
        let result;
        chai.expect(() => {
          result = Verifier.checkPaypro(testCase.txp, testCase.paypro);
        }).not.to.throw();
        chai.expect(result).to.equal(false);
      }
    });

    it('rejects invalid transaction proposal versions instead of coercing them', function() {
      const invalidVersions = [undefined, null, true, {}, [], [3], 0, -1, 1.5, '', ' ', '3x'];
      for (const version of invalidVersions) {
        chai.expect(
          Verifier.checkPaypro(createTxp('btc', { version }), createPaypro('btc')),
          String(version)
        ).to.equal(false);
      }
    });

    const malformedInstructionCases = [
      { description: 'rejects missing PayPro instructions without throwing', paypro: {} },
      { description: 'rejects empty PayPro instructions without throwing', paypro: { instructions: [] } }
    ];
    for (const testCase of malformedInstructionCases) {
      it(testCase.description, function() {
        let result;
        chai.expect(() => {
          result = Verifier.checkPaypro(createTxp('btc'), testCase.paypro);
        }).not.to.throw();
        chai.expect(result).to.equal(false);
      });
    }

    const malformedOutputCases = [
      { description: 'rejects a version 3 proposal with missing outputs without throwing', outputs: undefined },
      { description: 'rejects a version 3 proposal with empty outputs without throwing', outputs: [] }
    ];
    for (const testCase of malformedOutputCases) {
      it(testCase.description, function() {
        let result;
        chai.expect(() => {
          result = Verifier.checkPaypro(
            createTxp('btc', { outputs: testCase.outputs }),
            createPaypro('btc')
          );
        }).not.to.throw();
        chai.expect(result).to.equal(false);
      });
    }

    it('logs the entry index and invalid field for malformed outputs and instructions', function() {
      const warn = sinon.stub(log, 'warn');
      try {
        const outputs = [
          { toAddress: addresses.btc[0], amount: 5000 },
          { toAddress: ' ', amount: 5000 }
        ];
        const instructions = [
          { toAddress: addresses.btc[0], amount: 5000 },
          { toAddress: addresses.btc[1], amount: 5000 }
        ];
        Verifier.checkPaypro(
          createTxp('btc', { id: 'txp-id', outputs }),
          createPaypro('btc', { instructions })
        ).should.equal(false);
        sinon.assert.calledOnceWithExactly(
          warn,
          '[TXP txp-id] PayPro verification failed: transaction output at index 1 has an invalid destination address'
        );

        warn.resetHistory();
        instructions[1] = { toAddress: addresses.btc[1], amount: -1 };
        outputs[1] = { toAddress: addresses.btc[1], amount: 5000 };
        Verifier.checkPaypro(
          createTxp('btc', { id: 'txp-id', outputs }),
          createPaypro('btc', { instructions })
        ).should.equal(false);
        sinon.assert.calledOnceWithExactly(
          warn,
          '[TXP txp-id] PayPro verification failed: PayPro instruction at index 1 has an invalid amount'
        );
      } finally {
        warn.restore();
      }
    });

    const unparseableBchCases = [
      {
        description: 'rejects an unparseable BCH proposal destination without throwing',
        txp: createTxp('bch', { outputs: [{ toAddress: 'not-a-bch-address', amount }] }),
        paypro: createPaypro('bch')
      },
      {
        description: 'rejects an unparseable BCH PayPro destination without throwing',
        txp: createTxp('bch'),
        paypro: createPaypro('bch', {
          instructions: [{ toAddress: 'not-a-bch-address', amount }]
        })
      }
    ];
    for (const testCase of unparseableBchCases) {
      it(testCase.description, function() {
        let result;
        chai.expect(() => {
          result = Verifier.checkPaypro(testCase.txp, testCase.paypro);
        }).not.to.throw();
        chai.expect(result).to.equal(false);
      });
    }

    const legacyCases = [
      { chain: 'btc' },
      { chain: 'bch' },
      { chain: 'doge' },
      { chain: 'ltc' }
    ];
    for (const testCase of legacyCases) {
      it(`preserves matching legacy ${testCase.chain.toUpperCase()} transaction proposal behavior`, function() {
        const txp = createTxp(testCase.chain, {
          version: 2,
          chain: undefined,
          toAddress: addressFor(testCase.chain),
          outputs: undefined
        });
        Verifier.checkPaypro(txp, createPaypro(testCase.chain)).should.equal(true);
      });

      it(`rejects a legacy ${testCase.chain.toUpperCase()} transaction proposal destination mismatch`, function() {
        const txp = createTxp(testCase.chain, {
          version: 2,
          chain: undefined,
          toAddress: differentAddressFor(testCase.chain),
          outputs: undefined
        });
        Verifier.checkPaypro(txp, createPaypro(testCase.chain)).should.equal(false);
      });
    }

    it('accepts a proposal whose complete output set matches all PayPro instructions', function() {
      const txp = createTxp('btc', {
        outputs: [
          { toAddress: addresses.btc[1], amount: 4000 },
          { toAddress: addresses.btc[0], amount: 6000 }
        ]
      });
      const paypro = createPaypro('btc', {
        instructions: [
          { toAddress: addresses.btc[0], amount: 6000 },
          { toAddress: addresses.btc[1], amount: 4000 }
        ]
      });
      Verifier.checkPaypro(txp, paypro).should.equal(true);
    });

    it('accepts matching duplicate output and instruction pairs', function() {
      const entries = [
        { toAddress: addresses.btc[0], amount: 5000 },
        { toAddress: addresses.btc[0], amount: 5000 }
      ];
      const txp = createTxp('btc', { outputs: entries });
      const paypro = createPaypro('btc', { instructions: entries });
      Verifier.checkPaypro(txp, paypro).should.equal(true);
    });

    it('rejects a proposal when a non-first PayPro destination is changed', function() {
      const txp = createTxp('btc', {
        outputs: [
          { toAddress: addresses.btc[0], amount: 6000 },
          { toAddress: addresses.btc[1], amount: 4000 }
        ]
      });
      const paypro = createPaypro('btc', {
        instructions: [
          { toAddress: addresses.btc[0], amount: 6000 },
          { toAddress: '1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp', amount: 4000 }
        ]
      });
      Verifier.checkPaypro(txp, paypro).should.equal(false);
    });

    it('rejects different output and instruction counts even when totals match', function() {
      const txp = createTxp('btc');
      const paypro = createPaypro('btc', {
        instructions: [
          { toAddress: addresses.btc[0], amount: 6000 },
          { toAddress: addresses.btc[1], amount: 4000 }
        ]
      });
      Verifier.checkPaypro(txp, paypro).should.equal(false);
    });

    it('rejects an output amount change even when the proposal total still matches', function() {
      const txp = createTxp('btc', {
        outputs: [
          { toAddress: addresses.btc[0], amount: 5000 },
          { toAddress: addresses.btc[1], amount: 5000 }
        ]
      });
      const paypro = createPaypro('btc', {
        instructions: [
          { toAddress: addresses.btc[0], amount: 6000 },
          { toAddress: addresses.btc[1], amount: 4000 }
        ]
      });
      Verifier.checkPaypro(txp, paypro).should.equal(false);
    });

    it('rejects an output total that differs from the transaction amount', function() {
      const txp = createTxp('btc', {
        outputs: [{ toAddress: addresses.btc[0], amount: amount + 1 }]
      });
      Verifier.checkPaypro(txp, createPaypro('btc')).should.equal(false);
    });
  });

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
});
