'use strict';

import chai from 'chai';
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

  describe('checkPaypro', function() {
    const createPaypro = (chain, outputs) => ({
      chain,
      network: 'livenet',
      instructions: [{ outputs }]
    });
    const createTxp = (paypro, outputs) => ({
      version: 3,
      coin: paypro.chain,
      chain: paypro.chain,
      network: paypro.network,
      outputs
    });
    const addresses = {
      btc: ['1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu'],
      bch: ['qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a', 'qrvcdmgpk73zyfd8pmdl9wnuld36zh9n4gms8s0u59'],
      doge: ['DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L', 'DTdKu8YgcxoXyjFCDtCeKimaZzsK27rcwT'],
      ltc: ['MTf4tP1TCNBn8dNkyxeBVoPrFCcVzxJvvh', 'MQMcJhpWHYVeQArcZR3sBgyPZxxRtnH441']
    };

    it('should verify every UTXO output address and amount', function() {
      for (const [chain, [address, otherAddress]] of Object.entries(addresses)) {
        const paypro = createPaypro(chain, [{ address, amount: 10000 }]);
        const txp = createTxp(paypro, [{ toAddress: address, amount: 10000 }]);

        Verifier.checkPaypro(txp, paypro).should.be.true;
        Verifier.checkPaypro({
          ...txp,
          outputs: [{ toAddress: otherAddress, amount: 10000 }]
        }, paypro).should.be.false;
        Verifier.checkPaypro({
          ...txp,
          outputs: [{ toAddress: address, amount: 9999 }]
        }, paypro).should.be.false;
        Verifier.checkPaypro({
          ...txp,
          outputs: [
            { toAddress: address, amount: 1 },
            { toAddress: otherAddress, amount: 9999 }
          ]
        }, paypro).should.be.false;
      }
    });

    it('should verify every output of UTXO instructions', function() {
      const outputs = [
        { address: addresses.btc[0], amount: 6000 },
        { address: addresses.btc[1], amount: 4000 }
      ];
      const paypro = createPaypro('btc', outputs);
      const txp = createTxp(paypro, outputs.map(output => ({
        toAddress: output.address,
        amount: output.amount
      })));

      Verifier.checkPaypro(txp, paypro).should.be.true;
      Verifier.checkPaypro({ ...txp, outputs: [txp.outputs[0]] }, paypro).should.be.false;
      Verifier.checkPaypro({ ...txp, outputs: [...txp.outputs].reverse() }, paypro).should.be.false;
      Verifier.checkPaypro(txp, {
        ...paypro,
        instructions: [
          { outputs: [outputs[0]] },
          { outputs: [outputs[1]] }
        ]
      }).should.be.true;
    });

    it('should accept equivalent BCH encodings and reject malformed addresses', function() {
      const paypro = createPaypro('bch', [{ address: addresses.bch[0], amount: 10000 }]);
      const txp = createTxp(paypro, [{
        toAddress: '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu',
        amount: 10000
      }]);

      Verifier.checkPaypro(txp, paypro).should.be.true;
      Verifier.checkPaypro({
        ...txp,
        outputs: [{ toAddress: 'not-an-address', amount: 10000 }]
      }, paypro).should.be.false;
    });

    it('should reject unsupported or mismatched chain, network, or instruction shape', function() {
      const paypro = createPaypro('btc', [{ address: addresses.btc[0], amount: 10000 }]);
      const txp = createTxp(paypro, [{ toAddress: addresses.btc[0], amount: 10000 }]);

      Verifier.checkPaypro({ ...txp, chain: 'doge' }, paypro).should.be.false;
      Verifier.checkPaypro({ ...txp, network: 'testnet' }, paypro).should.be.false;
      Verifier.checkPaypro(txp, { ...paypro, instructions: [] }).should.be.false;
      Verifier.checkPaypro({ ...txp, chain: 'unknown' }, { ...paypro, chain: 'unknown' }).should.be.false;
    });

    it('should bind EVM payments to their contract and calldata', function() {
      const contract = '0xc27eD3DF0DE776246cdAD5a052A9982473FceaB8';
      const paypro = {
        chain: 'eth',
        network: 'livenet',
        instructions: [{ to: contract, value: 0, data: '0x095ea7b3aaaa' }]
      };
      const txp = createTxp(paypro, [{
        toAddress: contract.toLowerCase(),
        amount: 0,
        data: '0x095ea7b3aaaa'
      }]);

      Verifier.checkPaypro(txp, paypro).should.be.true;
      Verifier.checkPaypro({ ...txp, data: '0x095ea7b3deadbeef' }, paypro).should.be.false;
      Verifier.checkPaypro({
        ...txp,
        outputs: [{ ...txp.outputs[0], toAddress: '0x0000000000000000000000000000000000000001' }]
      }, paypro).should.be.false;
    });

    it('should bind XRP payments to the destination tag and invoice ID', function() {
      const address = 'rEqj9WKSH7wEkPvWf6b4gCi26Y3F7HbKUF';
      const invoiceID = '1012345678901234567890123456710123456789012345678901567890123456';
      const paypro = {
        chain: 'xrp',
        network: 'livenet',
        instructions: [{ outputs: [{ address, amount: 10000, destinationTag: 12345, invoiceID }] }]
      };
      const txp = {
        ...createTxp(paypro, [{ toAddress: address, amount: 10000 }]),
        destinationTag: '12345',
        invoiceID
      };
      const zeroTagPaypro = {
        ...paypro,
        instructions: [{ outputs: [{ ...paypro.instructions[0].outputs[0], destinationTag: 0 }] }]
      };

      Verifier.checkPaypro(txp, paypro).should.be.true;
      Verifier.checkPaypro({ ...txp, destinationTag: 999 }, paypro).should.be.false;
      Verifier.checkPaypro({ ...txp, multiTx: true }, paypro).should.be.false;
      Verifier.checkPaypro({ ...txp, txType: 'accountdelete' }, paypro).should.be.false;
      // The XRP transaction builders currently omit a zero destination tag
      Verifier.checkPaypro({ ...txp, destinationTag: '0' }, zeroTagPaypro).should.be.false;
      // both reach the ledger and the merchant reconciles the payment with them
      Verifier.checkPaypro({ ...txp, invoiceID: `2${invoiceID.slice(1)}` }, paypro).should.be.false;
      Verifier.checkPaypro({ ...txp, invoiceID: undefined }, paypro).should.be.false;
    });

    it('should bind SOL payments to the invoice ID carried as a memo', function() {
      const address = 'So11111111111111111111111111111111111111112';
      const paypro = {
        chain: 'sol',
        network: 'livenet',
        instructions: [{ outputs: [{ address, amount: 10000, invoiceID: 'LanynqCPoL2JQb8z8s5Z3X' }] }]
      };
      const txp = {
        ...createTxp(paypro, [{ toAddress: address, amount: 10000 }]),
        memo: 'LanynqCPoL2JQb8z8s5Z3X'
      };

      Verifier.checkPaypro(txp, paypro).should.be.true;
      Verifier.checkPaypro({ ...txp, memo: 'GsbhMZeeUebqzEeDmNubEP' }, paypro).should.be.false;
      Verifier.checkPaypro({ ...txp, memo: undefined }, paypro).should.be.false;
    });

    it('should bind every instruction of a multi-step EVM payment', function() {
      // ERC20 invoices use separate approve and payment instructions
      const tokenContract = '0xFEb423814D0208e9e2a3F5B0F0171e97376E20Bc';
      const paymentContract = '0xc27eD3DF0DE776246cdAD5a052A9982473FceaB8';
      const paypro = {
        chain: 'eth',
        network: 'livenet',
        instructions: [
          { to: tokenContract, value: 0, data: '0x095ea7b3aaaa' },
          { to: paymentContract, value: 0, data: '0xd7bb99babbbb' }
        ]
      };
      const outputs = paypro.instructions.map(i => ({ toAddress: i.to, amount: i.value, data: i.data }));
      const txp = createTxp(paypro, outputs);

      Verifier.checkPaypro(txp, paypro).should.be.true;
      // tampering with the second step must not slip past a correct first one
      Verifier.checkPaypro({
        ...txp,
        outputs: [outputs[0], { ...outputs[1], data: '0xd7bb99badeadbeef' }]
      }, paypro).should.be.false;
      Verifier.checkPaypro({
        ...txp,
        outputs: [outputs[0], { ...outputs[1], toAddress: tokenContract }]
      }, paypro).should.be.false;
      // dropping a step is not a valid payment either
      Verifier.checkPaypro({ ...txp, outputs: [outputs[0]] }, paypro).should.be.false;
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
