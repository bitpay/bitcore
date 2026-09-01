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
    // Equivalent-but-not-identical-string encodings that a chain's own address
    // library treats as the same destination. Bech32 forms below are derived
    // from a fixed test-only private key scalar so they are deterministic and
    // independently reproducible; the P2SH pair is the ticket's own fixture.
    const equivalenceFixtures = {
      btcBech32: {
        lower: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        upper: 'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4'
      },
      ltcBech32: {
        lower: 'ltc1qw508d6qejxtdg4y5r3zarvary0c5xw7kgmn4n9',
        upper: 'LTC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KGMN4N9'
      },
      ltcP2sh: {
        legacy: '3GueMn6ruWVfQTN4XKBGEbCbGLwRSUhfnS',
        modern: 'MP7nffWprdM6CxdxdCAc4ESzb3XsQQPZMp'
      }
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
      const txp = createTxp('btc', { chain: 'unsupportedchain' });
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

    const addressEquivalenceCases = [
      {
        description: 'accepts equivalent BTC Bech32 case forms',
        chain: 'btc',
        outputAddress: equivalenceFixtures.btcBech32.lower,
        instructionAddress: equivalenceFixtures.btcBech32.upper
      },
      {
        description: 'accepts equivalent LTC Bech32 case forms',
        chain: 'ltc',
        outputAddress: equivalenceFixtures.ltcBech32.lower,
        instructionAddress: equivalenceFixtures.ltcBech32.upper
      },
      {
        description: 'accepts equivalent LTC legacy 3... and modern M... P2SH destinations',
        chain: 'ltc',
        outputAddress: equivalenceFixtures.ltcP2sh.legacy,
        instructionAddress: equivalenceFixtures.ltcP2sh.modern
      }
    ];
    for (const testCase of addressEquivalenceCases) {
      it(testCase.description, function() {
        const txp = createTxp(testCase.chain, {
          outputs: [{ toAddress: testCase.outputAddress, amount }]
        });
        const paypro = createPaypro(testCase.chain, {
          instructions: [{ toAddress: testCase.instructionAddress, amount }]
        });
        Verifier.checkPaypro(txp, paypro).should.equal(true);
      });
    }

    const identicalMalformedDestinationChains = ['btc', 'bch', 'doge', 'ltc'];
    for (const chain of identicalMalformedDestinationChains) {
      it(`rejects identical malformed ${chain.toUpperCase()} destinations without throwing`, function() {
        const malformed = 'not-a-real-address!!!';
        const txp = createTxp(chain, { outputs: [{ toAddress: malformed, amount }] });
        const paypro = createPaypro(chain, { instructions: [{ toAddress: malformed, amount }] });
        let result;
        chai.expect(() => {
          result = Verifier.checkPaypro(txp, paypro);
        }).not.to.throw();
        chai.expect(result).to.equal(false);
      });

      it(`rejects a malformed ${chain.toUpperCase()} proposal destination with a valid PayPro instruction`, function() {
        const malformed = 'not-a-real-address!!!';
        const txp = createTxp(chain, { outputs: [{ toAddress: malformed, amount }] });
        let result;
        chai.expect(() => {
          result = Verifier.checkPaypro(txp, createPaypro(chain));
        }).not.to.throw();
        chai.expect(result).to.equal(false);
      });

      it(`rejects a malformed ${chain.toUpperCase()} PayPro instruction with a valid proposal destination`, function() {
        const malformed = 'not-a-real-address!!!';
        const paypro = createPaypro(chain, {
          instructions: [{ toAddress: malformed, amount }]
        });
        let result;
        chai.expect(() => {
          result = Verifier.checkPaypro(createTxp(chain), paypro);
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

    describe('account chains (EVM/XRP/SOL)', function() {
      const evmAddress = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
      const evmAddressUppercase = '0x' + evmAddress.slice(2).toUpperCase();
      const evmAddressLowercase = evmAddress.toLowerCase();
      const differentEvmAddress = '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A';
      // Same digits as evmAddress with one letter's case flipped - a valid
      // EIP-55 checksum encodes case, so this is a different, invalid
      // checksum rather than an equivalent encoding.
      const invalidChecksumEvmAddress = '0x9858effD232B4033E47d90003D41EC34EcaEda94';
      const xrpAddress = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';
      const differentXrpAddress = 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe';
      const solAddress = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
      const differentSolAddress = '7VHUFJHWu2CuExkJcJrzhQPJ2oygupTWkL2A2For4BiF';

      const createAccountTxp = (chain, overrides = {}) => ({
        version: 3,
        chain,
        coin: chain,
        amount,
        outputs: [{ toAddress: evmAddress, amount }],
        ...overrides
      });
      const createAccountPaypro = (overrides = {}) => ({
        instructions: [{ toAddress: evmAddress, amount }],
        ...overrides
      });

      const matchingAccountCases = [
        { description: 'accepts a matching ETH PayPro destination and amount', chain: 'eth' },
        { description: 'accepts a matching MATIC PayPro destination and amount', chain: 'matic' },
        { description: 'accepts a matching ARB PayPro destination and amount', chain: 'arb' },
        { description: 'accepts a matching BASE PayPro destination and amount', chain: 'base' },
        { description: 'accepts a matching OP PayPro destination and amount', chain: 'op' },
        { description: 'accepts a matching ARC PayPro destination and amount', chain: 'arc' }
      ];
      for (const testCase of matchingAccountCases) {
        it(testCase.description, function() {
          Verifier.checkPaypro(
            createAccountTxp(testCase.chain),
            createAccountPaypro()
          ).should.equal(true);
        });
      }

      it('accepts a matching XRP PayPro destination and amount', function() {
        const txp = createAccountTxp('xrp', { outputs: [{ toAddress: xrpAddress, amount }] });
        const paypro = createAccountPaypro({ instructions: [{ toAddress: xrpAddress, amount }] });
        Verifier.checkPaypro(txp, paypro).should.equal(true);
      });

      it('accepts a matching SOL PayPro destination and amount', function() {
        const txp = createAccountTxp('sol', { outputs: [{ toAddress: solAddress, amount }] });
        const paypro = createAccountPaypro({ instructions: [{ toAddress: solAddress, amount }] });
        Verifier.checkPaypro(txp, paypro).should.equal(true);
      });

      it('accepts a matching USDC-on-ETH PayPro destination and amount', function() {
        const txp = createAccountTxp('eth', { coin: 'usdc' });
        Verifier.checkPaypro(txp, createAccountPaypro()).should.equal(true);
      });

      it('accepts a matching token on a non-ETH EVM chain (USDC on MATIC)', function() {
        const txp = createAccountTxp('matic', { coin: 'usdc' });
        Verifier.checkPaypro(txp, createAccountPaypro()).should.equal(true);
      });

      it('rejects an ETH PayPro destination mismatch with the correct amount', function() {
        const txp = createAccountTxp('eth');
        const paypro = createAccountPaypro({ instructions: [{ toAddress: differentEvmAddress, amount }] });
        Verifier.checkPaypro(txp, paypro).should.equal(false);
      });

      it('rejects an XRP PayPro destination mismatch with the correct amount', function() {
        const txp = createAccountTxp('xrp', { outputs: [{ toAddress: xrpAddress, amount }] });
        const paypro = createAccountPaypro({ instructions: [{ toAddress: differentXrpAddress, amount }] });
        Verifier.checkPaypro(txp, paypro).should.equal(false);
      });

      it('rejects a SOL PayPro destination mismatch with the correct amount', function() {
        const txp = createAccountTxp('sol', { outputs: [{ toAddress: solAddress, amount }] });
        const paypro = createAccountPaypro({ instructions: [{ toAddress: differentSolAddress, amount }] });
        Verifier.checkPaypro(txp, paypro).should.equal(false);
      });

      it('accepts equivalent EVM checksum, lowercase, and uppercase destination forms', function() {
        const txp = createAccountTxp('eth', { outputs: [{ toAddress: evmAddressLowercase, amount }] });
        const paypro = createAccountPaypro({ instructions: [{ toAddress: evmAddressUppercase, amount }] });
        Verifier.checkPaypro(txp, paypro).should.equal(true);
      });

      it('rejects an EVM destination with an invalid mixed-case checksum', function() {
        const txp = createAccountTxp('eth', { outputs: [{ toAddress: invalidChecksumEvmAddress, amount }] });
        let result;
        chai.expect(() => {
          result = Verifier.checkPaypro(txp, createAccountPaypro());
        }).not.to.throw();
        chai.expect(result).to.equal(false);
      });

      it('rejects identical malformed XRP destinations without throwing', function() {
        const malformed = 'not-a-real-xrp-address';
        const txp = createAccountTxp('xrp', { outputs: [{ toAddress: malformed, amount }] });
        const paypro = createAccountPaypro({ instructions: [{ toAddress: malformed, amount }] });
        let result;
        chai.expect(() => {
          result = Verifier.checkPaypro(txp, paypro);
        }).not.to.throw();
        chai.expect(result).to.equal(false);
      });

      it('rejects identical malformed SOL destinations without throwing', function() {
        const malformed = 'not-a-real-sol-address';
        const txp = createAccountTxp('sol', { outputs: [{ toAddress: malformed, amount }] });
        const paypro = createAccountPaypro({ instructions: [{ toAddress: malformed, amount }] });
        let result;
        chai.expect(() => {
          result = Verifier.checkPaypro(txp, paypro);
        }).not.to.throw();
        chai.expect(result).to.equal(false);
      });

      it('accepts a known legacy ERC-20 coin fallback with no explicit chain', function() {
        // Utils.getChain() maps Constants.BITPAY_SUPPORTED_ETH_ERC20 coins
        // (e.g. 'usdc') to 'eth' for backwards compatibility when txp.chain
        // is absent - old-style token proposals rely on this.
        const txp = createAccountTxp('eth', { chain: undefined, coin: 'usdc' });
        Verifier.checkPaypro(txp, createAccountPaypro()).should.equal(true);
      });

      it('rejects an unknown chain-less coin instead of silently resolving it to ETH', function() {
        // Utils.getChain() also maps every *unrecognized* coin to 'eth' as a
        // catch-all. A PayPro-specific resolver must not inherit that
        // fallback, or an unknown coin paired with an ETH-shaped instruction
        // would be silently accepted once ETH support lands.
        const txp = createAccountTxp('eth', { chain: undefined, coin: 'notarealcoin' });
        Verifier.checkPaypro(txp, createAccountPaypro()).should.equal(false);
      });

      // Destination and amount alone are not a complete account-chain
      // instruction: EVM calldata, XRP's destination tag/invoice ID, SOL's
      // invoice memo, and the signed PayPro metadata can all change what a
      // proposal actually pays without changing its destination or amount.
      // Every case below starts from a valid base case above and mutates
      // only the field named in its description. `txp` is the untrusted
      // side (sourced from BWS); `paypro` is the signed, verified side - so
      // the security-relevant direction for every "one side omits it" case
      // is the proposal dropping a field the signed instruction has.
      describe('instruction semantics (data, ordering, tag, invoice ID, memo, metadata)', function() {
        const nativeData = '0xa9059cbb0000000000000000000000009858effd232b4033e47d90003d41ec34ecaeda94000000000000000000000000000000000000000000000000000000000000989680';
        const differentNativeData = '0xa9059cbb0000000000000000000000009858effd232b4033e47d90003d41ec34ecaeda940000000000000000000000000000000000000000000000000000000000000001';
        // Same bytes as `nativeData`, differing only in hex-letter case.
        const nativeDataUppercase = '0x' + nativeData.slice(2).toUpperCase();
        const malformedData = 'not-valid-hex-calldata';

        const createNativeEvmTxp = data =>
          createAccountTxp('eth', { outputs: [{ toAddress: evmAddress, amount, data }] });
        const createNativeEvmPaypro = data =>
          createAccountPaypro({ instructions: [{ toAddress: evmAddress, amount, to: evmAddress, value: amount, data }] });

        it('accepts a matching native EVM PayPro instruction with identical calldata', function() {
          Verifier.checkPaypro(createNativeEvmTxp(nativeData), createNativeEvmPaypro(nativeData)).should.equal(true);
        });

        it('accepts a native EVM PayPro instruction when calldata differs only by hex letter case', function() {
          Verifier.checkPaypro(createNativeEvmTxp(nativeData), createNativeEvmPaypro(nativeDataUppercase)).should.equal(true);
        });

        it('rejects a native EVM PayPro instruction when the calldata changes', function() {
          Verifier.checkPaypro(createNativeEvmTxp(nativeData), createNativeEvmPaypro(differentNativeData)).should.equal(false);
        });

        it('rejects a native EVM PayPro instruction when the proposal adds calldata absent from the signed instruction', function() {
          Verifier.checkPaypro(createNativeEvmTxp(nativeData), createNativeEvmPaypro(undefined)).should.equal(false);
        });

        it('rejects a native EVM PayPro instruction when the proposal omits the signed calldata', function() {
          // `txp` is untrusted (BWS-sourced)
          Verifier.checkPaypro(createNativeEvmTxp(undefined), createNativeEvmPaypro(nativeData)).should.equal(false);
        });

        // Utils.buildTx() (common/utils.ts) still applies a BWC <= 8.9.0
        // compatibility field, top-level `txp.data`, by overwriting
        // `outputs[0].data` at sign time. checkPaypro only ever inspects
        // `outputs[i].data`, so a proposal whose output already matches the
        // signed instruction can still carry a top-level override that
        // signs different calldata than what was just verified.
        it('rejects a native EVM PayPro instruction when a top-level legacy txp.data override differs from the signed calldata', function() {
          const txp = { ...createNativeEvmTxp(nativeData), data: differentNativeData };
          Verifier.checkPaypro(txp, createNativeEvmPaypro(nativeData)).should.equal(false);
        });

        it('accepts a native EVM PayPro instruction whose top-level legacy txp.data matches the signed calldata', function() {
          const txp = { ...createNativeEvmTxp(nativeData), data: nativeData };
          Verifier.checkPaypro(txp, createNativeEvmPaypro(nativeData)).should.equal(true);
        });

        it('rejects identical malformed native EVM calldata without throwing', function() {
          let result;
          chai.expect(() => {
            result = Verifier.checkPaypro(createNativeEvmTxp(malformedData), createNativeEvmPaypro(malformedData));
          }).not.to.throw();
          chai.expect(result).to.equal(false);
        });

        // Real ERC-20 PayPro requests contain an ordered `approve` call
        // followed by BitPay's `pay` call, both with a zero visible amount -
        // the actual token amount and recipient live in calldata. Addresses
        // and calldata below are real: `tokenContractAddress` is mainnet
        // USDC's actual contract address (crypto-wallet-core's token
        // registry), and `approveData`/`payData` are produced by ABI-encoding
        // `approve(address,uint256)` and BWS's real `Invoice.pay(...)`
        // signature (chain/eth/abi-invoice.ts) with `ethers.Interface` -
        // not hand-written hex - so their selectors and argument layout are
        // genuine. `payContractAddress` is an arbitrary but validly
        // EIP-55-checksummed placeholder for BitPay's invoice contract; it
        // does not correspond to any deployed contract.
        const tokenContractAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
        const payContractAddress = '0x1BA1E35A29E2A52a1b1A1e2c8dbB28B9B5B6f7C1';
        const approveData = '0x095ea7b30000000000000000000000001ba1e35a29e2a52a1b1a1e2c8dbb28b9b5b6f7c10000000000000000000000000000000000000000000000000000000000989680';
        const payData = '0xb6b4af05000000000000000000000000000000000000000000000000000000000098968000000000000000000000000000000000000000000000000000000009502f9000000000000000000000000000000000000000000000000000000001b8dac5b40000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001b00000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000004000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const differentPayData = '0xb6b4af05000000000000000000000000000000000000000000000000000000000098967f00000000000000000000000000000000000000000000000000000009502f9000000000000000000000000000000000000000000000000000000001b8dac5b40000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001b00000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000004000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

        const createErc20Txp = (overrides = {}) => createAccountTxp('eth', {
          coin: 'usdc',
          amount: 0,
          outputs: [
            { toAddress: tokenContractAddress, amount: 0, data: approveData },
            { toAddress: payContractAddress, amount: 0, data: payData }
          ],
          ...overrides
        });
        const createErc20Paypro = (overrides = {}) => createAccountPaypro({
          instructions: [
            { toAddress: tokenContractAddress, amount: 0, to: tokenContractAddress, value: 0, data: approveData },
            { toAddress: payContractAddress, amount: 0, to: payContractAddress, value: 0, data: payData }
          ],
          ...overrides
        });

        it('accepts ordered ERC-20 approve and pay instructions with zero visible amounts', function() {
          Verifier.checkPaypro(createErc20Txp(), createErc20Paypro()).should.equal(true);
        });

        it('rejects an ERC-20 proposal when the second (pay) instruction calldata changes', function() {
          const paypro = createErc20Paypro({
            instructions: [
              { toAddress: tokenContractAddress, amount: 0, to: tokenContractAddress, value: 0, data: approveData },
              { toAddress: payContractAddress, amount: 0, to: payContractAddress, value: 0, data: differentPayData }
            ]
          });
          Verifier.checkPaypro(createErc20Txp(), paypro).should.equal(false);
        });

        it('rejects an ERC-20 proposal with the approve and pay instructions swapped', function() {
          // Account-chain contract calls are ordered
          // Swapping which call runs first changes what the
          // transaction does even though the same two entries are present.
          const paypro = createErc20Paypro({
            instructions: [
              { toAddress: payContractAddress, amount: 0, to: payContractAddress, value: 0, data: payData },
              { toAddress: tokenContractAddress, amount: 0, to: tokenContractAddress, value: 0, data: approveData }
            ]
          });
          Verifier.checkPaypro(createErc20Txp(), paypro).should.equal(false);
        });

        // The app copies `destinationTag`/`invoiceID` from the PayPro
        // instruction's nested `outputs[0]` onto the top-level transaction
        // proposal fields BWS persists (`txp.destinationTag`/`txp.invoiceID`).
        const xrpTag = 12345;
        const xrpInvoiceId = '0000000000000000000000000000000000000000000000000000000000000001';

        const createXrpTxp = (destinationTag, invoiceID) => createAccountTxp('xrp', {
          outputs: [{ toAddress: xrpAddress, amount }],
          destinationTag,
          invoiceID
        });
        const createXrpPaypro = (destinationTag, invoiceID) => createAccountPaypro({
          instructions: [{
            toAddress: xrpAddress,
            amount,
            outputs: [{ address: xrpAddress, amount, destinationTag, invoiceID }]
          }]
        });

        it('accepts a matching XRP PayPro instruction with a destination tag and invoice ID', function() {
          Verifier.checkPaypro(createXrpTxp(xrpTag, xrpInvoiceId), createXrpPaypro(xrpTag, xrpInvoiceId)).should.equal(true);
        });

        it('rejects an XRP PayPro instruction when the destination tag changes', function() {
          Verifier.checkPaypro(createXrpTxp(xrpTag, xrpInvoiceId), createXrpPaypro(xrpTag + 1, xrpInvoiceId)).should.equal(false);
        });

        it('rejects an XRP PayPro instruction when the invoice ID changes', function() {
          const differentInvoiceId = '0000000000000000000000000000000000000000000000000000000000000002';
          Verifier.checkPaypro(createXrpTxp(xrpTag, xrpInvoiceId), createXrpPaypro(xrpTag, differentInvoiceId)).should.equal(false);
        });

        it('accepts an XRP PayPro instruction when the destination tag differs only in type', function() {
          Verifier.checkPaypro(createXrpTxp('12345', xrpInvoiceId), createXrpPaypro(xrpTag, xrpInvoiceId)).should.equal(true);
        });

        it('rejects an XRP PayPro instruction when the proposal omits the signed destination tag', function() {
          Verifier.checkPaypro(createXrpTxp(undefined, xrpInvoiceId), createXrpPaypro(xrpTag, xrpInvoiceId)).should.equal(false);
        });

        it('rejects an XRP PayPro instruction when the proposal adds a destination tag absent from the signed instruction', function() {
          Verifier.checkPaypro(createXrpTxp(xrpTag, xrpInvoiceId), createXrpPaypro(undefined, xrpInvoiceId)).should.equal(false);
        });

        it('rejects an XRP PayPro instruction when the proposal omits the signed invoice ID', function() {
          Verifier.checkPaypro(createXrpTxp(xrpTag, undefined), createXrpPaypro(xrpTag, xrpInvoiceId)).should.equal(false);
        });

        it('rejects an XRP PayPro instruction when the proposal adds an invoice ID absent from the signed instruction', function() {
          Verifier.checkPaypro(createXrpTxp(xrpTag, xrpInvoiceId), createXrpPaypro(xrpTag, undefined)).should.equal(false);
        });

        // The app maps the PayPro instruction's `outputs[0].invoiceID` to
        // `txp.memo` for SOL, which is serialized on-chain as a memo
        // instruction.
        const solMemo = 'SolInvoiceFixture1';
        const differentSolMemo = 'SolInvoiceFixture2';

        const createSolTxp = memo => createAccountTxp('sol', {
          outputs: [{ toAddress: solAddress, amount }],
          memo
        });
        const createSolPaypro = memo => createAccountPaypro({
          instructions: [{
            toAddress: solAddress,
            amount,
            outputs: [{ address: solAddress, amount, invoiceID: memo }]
          }]
        });

        it('accepts a matching SOL PayPro instruction with an invoice memo', function() {
          Verifier.checkPaypro(createSolTxp(solMemo), createSolPaypro(solMemo)).should.equal(true);
        });

        it('rejects a SOL PayPro instruction when the invoice memo changes', function() {
          Verifier.checkPaypro(createSolTxp(solMemo), createSolPaypro(differentSolMemo)).should.equal(false);
        });

        it('rejects a SOL PayPro instruction when the proposal omits the signed invoice memo', function() {
          Verifier.checkPaypro(createSolTxp(undefined), createSolPaypro(solMemo)).should.equal(false);
        });

        it('rejects a SOL PayPro instruction when the proposal adds a memo absent from the signed instruction', function() {
          Verifier.checkPaypro(createSolTxp(solMemo), createSolPaypro(undefined)).should.equal(false);
        });

        // Fields from the signed PayPro response itself (chain/network/
        // currency), as promoted by PayProV2.processResponse, rather than
        // fields on the unverified transaction proposal.
        const createSignedPaypro = (overrides = {}) => createAccountPaypro({
          chain: 'eth',
          network: 'livenet',
          currency: 'ETH',
          ...overrides
        });

        it('accepts a matching ETH PayPro proposal whose signed chain/network/currency agree', function() {
          Verifier.checkPaypro(createAccountTxp('eth', { network: 'livenet' }), createSignedPaypro()).should.equal(true);
        });

        it('rejects a signed PayPro chain mismatch', function() {
          const txp = createAccountTxp('eth', { network: 'livenet' });
          Verifier.checkPaypro(txp, createSignedPaypro({ chain: 'matic' })).should.equal(false);
        });

        it('rejects a signed PayPro network mismatch', function() {
          const txp = createAccountTxp('eth', { network: 'livenet' });
          Verifier.checkPaypro(txp, createSignedPaypro({ network: 'testnet' })).should.equal(false);
        });

        it('rejects a signed PayPro currency mismatch', function() {
          const txp = createAccountTxp('eth', { network: 'livenet', coin: 'eth' });
          Verifier.checkPaypro(txp, createSignedPaypro({ currency: 'USDC' })).should.equal(false);
        });

        // Currency comparison must resolve through
        // Utils.getCurrencyCodeFromCoinAndChain, not a naive
        // `coin.toUpperCase()`, which would both reject legitimate aliased
        // proposals and accept ones that skip a required alias.
        it('accepts a matching PayPro currency when the legacy POL/MATIC alias applies', function() {
          const txp = createAccountTxp('matic', { network: 'livenet', coin: 'pol' });
          Verifier.checkPaypro(txp, createSignedPaypro({ chain: 'matic', currency: 'MATIC' })).should.equal(true);
        });

        it('accepts a matching PayPro currency when the legacy USDP/PAX alias applies', function() {
          // PayProV2.selectPaymentOption rewrites an outgoing 'USDP' request
          // to 'PAX' before it reaches the PayPro server (payproV2.ts), so a
          // real signed response for a `coin: 'usdp'` proposal carries
          // currency 'PAX', not 'USDP'. That request-time rewrite is exactly
          // why this equivalence must be checked here, not a reason to skip it.
          const txp = createAccountTxp('eth', { network: 'livenet', coin: 'usdp' });
          Verifier.checkPaypro(txp, createSignedPaypro({ chain: 'eth', currency: 'PAX' })).should.equal(true);
        });

        it('accepts a matching PayPro currency when the Matic USDC chain-suffix alias applies', function() {
          const txp = createAccountTxp('matic', { network: 'livenet', coin: 'usdc' });
          Verifier.checkPaypro(txp, createSignedPaypro({ chain: 'matic', currency: 'USDCn_m' })).should.equal(true);
        });

        it('rejects a PayPro currency that skips the required Matic USDC chain-suffix alias', function() {
          // getCurrencyCodeFromCoinAndChain('usdc', 'matic') is 'USDCn_m',
          // not bare 'USDC' - an implementation that compares
          // `coin.toUpperCase()` directly would wrongly accept this.
          const txp = createAccountTxp('matic', { network: 'livenet', coin: 'usdc' });
          Verifier.checkPaypro(txp, createSignedPaypro({ chain: 'matic', currency: 'USDC' })).should.equal(false);
        });
      });
    });
  });

  describe('checkTxProposal PayPro boundary', function() {
    const amount = 10000;
    const merchantAddress = 'LQqWdV81RmiEzXoACvWDQPZEXXU1Q16suH';
    const substitutedAddress = 'Lcyaicjq2aFgcgRX5mDhhQkXN8RFvzWowa';
    const paypro = {
      instructions: [{ toAddress: merchantAddress, amount }]
    };
    const createTxp = toAddress => ({
      version: 3,
      chain: 'ltc',
      coin: 'ltc',
      amount,
      outputs: [{ toAddress, amount }]
    });
    let checkTxProposalSignatureStub;

    beforeEach(function() {
      checkTxProposalSignatureStub = sinon
        .stub(Verifier, 'checkTxProposalSignature')
        .returns(true);
    });

    afterEach(function() {
      checkTxProposalSignatureStub.restore();
    });

    it('accepts a matching LTC PayPro proposal through checkTxProposal', function() {
      Verifier.checkTxProposal({}, createTxp(merchantAddress), { paypro }).should.equal(true);
      sinon.assert.calledOnce(checkTxProposalSignatureStub);
    });

    it('rejects a substituted LTC PayPro destination through checkTxProposal', function() {
      Verifier.checkTxProposal({}, createTxp(substitutedAddress), { paypro }).should.equal(false);
      sinon.assert.calledOnce(checkTxProposalSignatureStub);
    });

    // Account-chain equivalent of the LTC boundary control above.
    const evmAddress = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
    const differentEvmAddress = '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A';
    const evmPaypro = { instructions: [{ toAddress: evmAddress, amount }] };
    const createEvmTxp = toAddress => ({
      version: 3,
      chain: 'eth',
      coin: 'eth',
      amount,
      outputs: [{ toAddress, amount }]
    });

    it('accepts a matching ETH PayPro proposal through checkTxProposal', function() {
      Verifier.checkTxProposal({}, createEvmTxp(evmAddress), { paypro: evmPaypro }).should.equal(true);
      sinon.assert.calledOnce(checkTxProposalSignatureStub);
    });

    it('rejects a substituted ETH PayPro destination through checkTxProposal', function() {
      Verifier.checkTxProposal({}, createEvmTxp(differentEvmAddress), { paypro: evmPaypro }).should.equal(false);
      sinon.assert.calledOnce(checkTxProposalSignatureStub);
    });

    // Same destination and amount, different calldata - the destination
    // check alone is not be enough to accept an EVM PayPro proposal.
    const evmData = '0xa9059cbb0000000000000000000000009858effd232b4033e47d90003d41ec34ecaeda94000000000000000000000000000000000000000000000000000000000000989680';
    const differentEvmData = '0xa9059cbb0000000000000000000000009858effd232b4033e47d90003d41ec34ecaeda940000000000000000000000000000000000000000000000000000000000000001';
    const evmDataPaypro = { instructions: [{ toAddress: evmAddress, amount, to: evmAddress, value: amount, data: evmData }] };
    const createEvmTxpWithData = data => ({
      version: 3,
      chain: 'eth',
      coin: 'eth',
      amount,
      outputs: [{ toAddress: evmAddress, amount, data }]
    });

    it('accepts a matching ETH PayPro proposal with identical calldata through checkTxProposal', function() {
      Verifier.checkTxProposal({}, createEvmTxpWithData(evmData), { paypro: evmDataPaypro }).should.equal(true);
      sinon.assert.calledOnce(checkTxProposalSignatureStub);
    });

    it('rejects an ETH PayPro proposal whose calldata was substituted through checkTxProposal', function() {
      Verifier.checkTxProposal({}, createEvmTxpWithData(differentEvmData), { paypro: evmDataPaypro }).should.equal(false);
      sinon.assert.calledOnce(checkTxProposalSignatureStub);
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
