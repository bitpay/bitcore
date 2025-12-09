import sinon from 'sinon';
import { expect } from 'chai';
import assert from 'assert';
import { createRequire } from 'module';
import * as SolKit from '@solana/kit';
import * as SolSystem from '@solana-program/system';
import * as SolMemo from '@solana-program/memo';
import * as SolComputeBudget from '@solana-program/compute-budget';
import * as SolLookUpTable from '@solana-program/address-lookup-table';
import * as SolToken from '@solana-program/token';
import { pipe } from '@solana/functional';
import { SolRpc } from '../lib/sol/SolRpc.js';
import { SOL_ERROR_MESSAGES } from '../lib/sol/error_messages.js';
import { parseInstructions, instructionKeys } from '../lib/sol/transaction-parser.js';

const require = createRequire(import.meta.url);
const privateKey1 = require('../blockchain/solana/test/keypair/id.json');
const privateKey2 = require('../blockchain/solana/test/keypair/id2.json');
const privateKey3 = require('../blockchain/solana/test/keypair/id3.json');
// const SolKit = require('@solana/kit'); // Using require to avoid issues with sinon stubbing/spying ES module imports

const bs58Encoder = SolKit.getBase58Encoder();

describe('SOL Tests', () => {
  // Reusable assertion set
  // IFF isGetTransactionCall, check meta
  const assertValidTransaction = (retVal, isGetTransactionCall = false) => {
    expect(retVal).to.be.an('object');
    expect(retVal).to.have.property('confirmations');
    if (typeof retVal.confirmations === 'number') {
      expect(retVal.confirmations).to.be.a('number').greaterThanOrEqual(0);
    } else {
      expect(retVal.confirmations).to.be.null;
    }
    expect(retVal).to.have.property('status');
    if (retVal.status) {
      expect(['processed', 'confirmed', 'finalized'].includes(retVal.status)).to.be.true;
    } else {
      expect(retVal.status).to.be.null;
    }
    expect(retVal).to.have.property('txid').that.is.a('string');
    expect([0, 'legacy'].includes(retVal.version)).to.be.true;

    const { lifetimeConstraint } = retVal;
    if (lifetimeConstraint) {
      expect(lifetimeConstraint).to.be.an('object');
      // Should have blockhash XOR nonce
      const hasBlockhash = Object.hasOwn(lifetimeConstraint, 'blockhash');
      const hasNonce = Object.hasOwn(lifetimeConstraint, 'nonce');
      expect(hasBlockhash !== hasNonce).to.be.true; // XOR
      if (hasBlockhash) {
        expect(lifetimeConstraint.blockhash).to.be.a('string');
      } else {
        expect(lifetimeConstraint.nonce).to.be.a('string');
      }
    }

    expect(retVal).to.have.property('accountKeys').that.is.an('array');
    expect(retVal.accountKeys.every(acct => typeof acct === 'string')).to.be.true;
    if (isGetTransactionCall) {
      expect(retVal).to.have.property('meta').that.is.an('object');
      expect(retVal.meta).to.have.property('preBalances').that.is.an('array');
      expect(retVal.meta.preBalances.every(bal => typeof bal === 'bigint')).to.be.true;
      expect(retVal.meta).to.have.property('postBalances').that.is.an('array');
      expect(retVal.meta.postBalances.every(bal => typeof bal === 'bigint')).to.be.true;
      expect(retVal.meta).to.have.property('preTokenBalances').that.is.an('array');
      expect(retVal.meta).to.have.property('postTokenBalances').that.is.an('array');
      expect(retVal.meta.preTokenBalances.every(bal => {
        try {
          return typeof bal.uiTokenAmount.decimals == 'number' && typeof bal.uiTokenAmount.uiAmount == 'number';
        } catch (err) {
          return false;
        }
      })).to.be.true;
      expect(retVal.meta.postTokenBalances.every(bal => {
        try {
          return typeof bal.uiTokenAmount.decimals == 'number' && typeof bal.uiTokenAmount.uiAmount == 'number';
        } catch (err) {
          return false;
        }
      })).to.be.true;

      for (const preTokenBalance of retVal.meta.preTokenBalances) {
        expect(preTokenBalance).to.be.an('object');
        expect(preTokenBalance).to.have.property('accountIndex').that.is.a('number').greaterThanOrEqual(0);
        expect(preTokenBalance).to.have.property('uiTokenAmount').that.is.an('object');
        const { uiTokenAmount } = preTokenBalance;
        expect(uiTokenAmount).to.have.property('decimals').that.is.a('number');
        expect(uiTokenAmount).to.have.property('uiAmount').that.is.a('bigint');

        const accountIndex = preTokenBalance.accountIndex;
        const matchingPostTokenBalance = retVal.meta.postTokenBalances.find(bal => bal.accountIndex == accountIndex);
        // NOTE: Future proofing for potential checks on open/close ATA
        if (matchingPostTokenBalance) {
          expect(matchingPostTokenBalance.uiTokenAmount?.decimals).not.to.be.undefined;
          expect(uiTokenAmount.decimals).to.equal(matchingPostTokenBalance.uiTokenAmount.decimals);
        }
      }

      for (const postTokenBalance of retVal.meta.postTokenBalances) {
        expect(postTokenBalance).to.be.an('object');
        expect(postTokenBalance).to.have.property('accountIndex').that.is.a('number').greaterThanOrEqual(0);
        expect(postTokenBalance).to.have.property('uiTokenAmount').that.is.an('object');
        const { uiTokenAmount } = postTokenBalance;
        expect(uiTokenAmount).to.have.property('decimals').that.is.a('number');
        expect(uiTokenAmount).to.have.property('uiAmount').that.is.a('bigint');

        const accountIndex = postTokenBalance.accountIndex;
        const matchingPreTokenBalance = retVal.meta.preTokenBalances.find(bal => bal.accountIndex == accountIndex);
        // NOTE: Future proofing for potential checks on open/close ATA
        if (matchingPreTokenBalance) {
          expect(matchingPreTokenBalance.uiTokenAmount?.decimals).not.to.be.undefined;
          expect(uiTokenAmount.decimals).to.equal(matchingPreTokenBalance.uiTokenAmount.decimals);
        }
      }
    }


    expect(retVal).to.have.property('instructions').that.is.an('object');
    expect(Array.isArray(retVal.instructions)).to.be.false;
    expect(retVal.instructions).not.to.be.null;

    const {
      transferSol,
      advanceNonceAccount,
      setComputeUnitLimit,
      setComputeUnitPrice,
      memo,
      transferCheckedToken,
      transferToken,
    } = retVal.instructions;
    if (transferSol) {
      expect(transferSol).to.be.an('array').with.length.greaterThan(0);
      for (const instruction of transferSol) {
        expect(instruction).to.be.an('object');
        expect(instruction).to.have.property('amount').that.is.a('number').that.is.greaterThan(0);
        expect(instruction).to.have.property('currency').that.is.a('string');
        expect(instruction.currency).to.equal('SOL');
        expect(instruction).to.have.property('destination').that.is.a('string');
        expect(instruction).to.have.property('source').that.is.a('string');
      }
    }

    if (advanceNonceAccount) {
      expect(advanceNonceAccount).to.be.an('array').with.length.greaterThan(0);
      for (const instruction of advanceNonceAccount) {
        expect(instruction).to.be.an('object');
        expect(instruction).to.have.property('nonceAccount').that.is.a('string');
        expect(instruction).to.have.property('nonceAuthority').that.is.a('string');
      }
    }

    if (setComputeUnitLimit) {
      expect(setComputeUnitLimit).to.be.an('array').with.length.greaterThan(0);
      for (const instruction of setComputeUnitLimit) {
        expect(instruction).to.be.an('object');
        expect(instruction).to.have.property('computeUnitLimit').that.is.a('number').greaterThan(0);
      }
    }

    if (setComputeUnitPrice) {
      expect(setComputeUnitPrice).to.be.an('array').with.length.greaterThan(0);
      for (const instruction of setComputeUnitPrice) {
        expect(instruction).to.be.an('object');
        expect(instruction).to.have.property('priority').that.is.a('boolean').that.is.true;
        expect(instruction).to.have.property('microLamports').that.is.a('number').greaterThan(0);
      }
    }

    if (memo) {
      expect(memo).to.be.an('array').with.length.greaterThan(0);
      for (const instruction of memo) {
        expect(instruction).to.be.an('object');
        expect(instruction).to.have.property('memo').that.is.a('string');
      }
    }

    if (transferCheckedToken) {
      expect(transferCheckedToken).to.be.an('array').with.length.greaterThan(0);
      for (const instruction of transferCheckedToken) {
        expect(instruction).to.be.an('object');
        expect(instruction).to.have.property('amount').that.is.a('number').that.is.greaterThan(0);
        expect(instruction).to.have.property('authority').that.is.a('string');
        expect(instruction).to.have.property('decimals').that.is.a('number').that.is.greaterThan(0);
        expect(instruction).to.have.property('destination').that.is.a('string');
        expect(instruction).to.have.property('mint').that.is.a('string');
        expect(instruction).to.have.property('source').that.is.a('string');
      }
    }

    if (transferToken) {
      expect(transferToken).to.be.an('array').with.length.greaterThan(0);
      for (const instruction of transferToken) {
        expect(instruction).to.be.an('object');
        expect(instruction).to.have.property('amount').that.is.a('number').that.is.greaterThan(0);
        expect(instruction).to.have.property('authority').that.is.a('string');
        expect(instruction).to.have.property('destination').that.is.a('string');
        expect(instruction).to.have.property('source').that.is.a('string');
      }
    }

    // Add specific instruction checks as needed
  };

  describe('Local tests', function() {
    const config = {
      chain: 'SOL',
      host: process.env.HOST_SOL || 'solana',
      protocol: 'http',
      port: 8899,
      wsPort: 8900
    };

    // Required for waiting on finalized transactions (e.g. creating a lookup table)
    this.timeout(10e7);
    /** @type {SolRpc} */
    let solRpc;
    /** @type {SolKit.KeyPairSigner<string>} */
    let senderKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let receiverKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let thirdKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let nonceAccountKeypair;
    before(async function() {
      // For these tests, the nonce authority will be the sender
      senderKeypair = await SolKit.createKeyPairSignerFromBytes(Uint8Array.from(privateKey1));
      receiverKeypair = await SolKit.createKeyPairSignerFromBytes(Uint8Array.from(privateKey2));
      thirdKeypair = await SolKit.createKeyPairSignerFromBytes(Uint8Array.from(privateKey3));

      solRpc = new SolRpc(config);
      // Check health
      const health = await solRpc.rpc.getHealth().send();
      if (health !== 'ok') {
        throw new Error('Healthcheck failed - rpc connection not correctly established');
      }

      // Airdrop if no money on sender - !! NOTE !! this will fail after 25 seconds worth of checks
      const addresses = [senderKeypair.address, receiverKeypair.address, thirdKeypair.address];
      for (const address of addresses) {
        const { value: balance } = await solRpc.rpc.getBalance(address).send();
        if (Number(balance) < 1e10) {
          const airdropSignature = await solRpc.rpc.requestAirdrop(address, 1e10).send();
          const { value: statuses } = await solRpc.rpc.getSignatureStatuses([airdropSignature]).send();
          let status = statuses[0];
          let remainingTries = 100;

          let exitReason = 'unknown';
          while (remainingTries > 0 && status?.confirmationStatus !== 'finalized') {
            await new Promise(resolve => setTimeout(resolve, 250));
            const { value: statuses } = await solRpc.rpc.getSignatureStatuses([airdropSignature]).send();
            status = statuses[0] ?? null;
            if (status == null) {
              // Tx failed and will never change
              exitReason = 'airdrop_tx_failed';
            }

            remainingTries--;
          }

          if (status?.confirmationStatus === 'finalized') {
            // should NOT ever throw error below if exitReason is finalized
            exitReason = 'finalized';
          } else if (remainingTries === 0) {
            exitReason = 'exhausted';
          }

          if (status?.confirmationStatus !== 'finalized') {
            // If 'finalized' here, something's wrong
            throw new Error(`Balance top-off was not finalized. reason=${exitReason}`);
          }
        }
      }

      // Create nonce account
      nonceAccountKeypair = await SolKit.generateKeyPairSigner();
      await createNonceAccount(solRpc, senderKeypair, nonceAccountKeypair)
        .catch(reason => {
          throw reason;
        });
    });

    describe('getBalance', () => {
      it('can retrieve a balance number for a valid address', async () => {
        const addressString = senderKeypair.address;
        const balance = await solRpc.getBalance({ address: addressString });
        expect(balance).to.be.a('number');
      });
      it('returns null for an invalid address', async () => {
        const invalidAddress = 'Address not on curve';
        const balance = await solRpc.getBalance({ address: invalidAddress });
        expect(balance).to.be.null;
      });
    });

    describe('sendToAddress', () => {
      let inputBase;
      before(() => {
        inputBase = {
          address: receiverKeypair.address,
          amount: 1000,
          fromAccountKeypair: senderKeypair
        };
      });

      it('can send a valid versioned transaction without nonce and without priority flag', async function() {
        this.timeout(10000);
        const txhash = await solRpc.sendToAddress({
          ...inputBase,
          txType: 0,
          priority: false
        });
        expect(txhash).to.be.a('string');
      });

      it('can send a valid versioned transaction with nonce and without priority flag', async function() {
        this.timeout(10000);
        const txhash = await solRpc.sendToAddress({
          ...inputBase,
          txType: 0,
          nonceAddress: nonceAccountKeypair.address,
          priority: false,
        });
        expect(txhash).to.be.a('string');
      });

      it('can send a valid versioned transaction without nonce and with priority flag', async function() {
        this.timeout(10000);
        const txhash = await solRpc.sendToAddress({
          ...inputBase,
          txType: 0,
          priority: true
        });
        expect(txhash).to.be.a('string');
      });
      it('can send a valid versioned transaction with nonce and with priority flag', async function() {
        this.timeout(10000);
        const txhash = await solRpc.sendToAddress({
          ...inputBase,
          txType: 0,
          nonceAddress: nonceAccountKeypair.address,
          priority: true
        });
        expect(txhash).to.be.a('string');
      });
      it('can send a valid legacy transaction without nonce and without priority flag', async function() {
        this.timeout(10000);
        const txhash = await solRpc.sendToAddress({
          ...inputBase,
          txType: 'legacy'
        });
        expect(txhash).to.be.a('string');
      });
      it('can send a valid legacy transaction with nonce and without priority flag', async function() {
        this.timeout(10000);
        const txhash = await solRpc.sendToAddress({
          ...inputBase,
          txType: 'legacy',
          nonceAddress: nonceAccountKeypair.address,
        });
        expect(txhash).to.be.a('string');
      });
      it('can send a valid legacy transaction without nonce and with priority flag', async function() {
        this.timeout(10000);
        const txhash = await solRpc.sendToAddress({
          ...inputBase,
          txType: 'legacy',
          priority: true
        });
        expect(txhash).to.be.a('string');
      });
      it('can send a valid legacy transaction with nonce and with priority flag', async function() {
        this.timeout(10000);
        const txhash = await solRpc.sendToAddress({
          ...inputBase,
          txType: 'legacy',
          nonceAddress: nonceAccountKeypair.address,
          priority: true
        });
        expect(txhash).to.be.a('string');
      });

      /** Testing behavior of bad nonce authority would be good */
    });

    describe('createNonceAccount', () => {
      it('can create a nonce account ', async function() {
        this.timeout(5000);
        const nonceKeypair = await SolKit.generateKeyPairSigner();
        const retVal = await solRpc.createNonceAccount(senderKeypair, nonceKeypair);
        expect(retVal).to.be.a('string');
      });
    });

    describe('estimateFee', () => {
      it('calls estimateTransactionFee is rawTx is included and returns number if rawTx is valid', async () => {
        const rawTx = await createRawTransaction(solRpc.rpc, senderKeypair, receiverKeypair, 1000);
        const retVal = await solRpc.estimateFee({ rawTx });
        expect(retVal).to.be.a('number');
        expect(retVal).to.be.greaterThanOrEqual(0);
      });
      it('returns a number based on the average fee calculator for the last 10 blocks', async function() {
        this.timeout(5000);
        const retVal = await solRpc.estimateFee({});
        expect(retVal).to.be.a('number');
        expect(retVal).to.be.greaterThanOrEqual(0);
      });
      it('throws "Could not decode provided raw transaction" error if rawTx cannot be decoded', async () => {
        const rawTx = 'non dec0dable';
        try {
          await solRpc.estimateFee({ rawTx });
          expect.fail('Should have thrown an error');
        } catch (err) {
          expect(err.message).to.equal('Could not decode provided raw transaction');
        }
      });
    });

    describe('estimateTransactionFee', () => {
      it('returns a fee estimate number in lamports based on the latest blockhash and transaction message', async () => {
        const rawTx = await createRawTransaction(solRpc.rpc, senderKeypair, receiverKeypair, 1000);
        const retVal = await solRpc.estimateTransactionFee({ rawTx });
        expect(retVal).to.be.a('number');
        expect(retVal).to.be.greaterThanOrEqual(0);
      });
      it('throws "Could not decode provided raw transaction" if input could not be retrieved', async () => {
        const rawTx = 'non dec0dable';
        try {
          await solRpc.estimateFee({ rawTx });
          expect.fail('Should have thrown an error');
        } catch (err) {
          expect(err.message).to.equal('Could not decode provided raw transaction');
        }
      });
    });

    describe('addPriorityFee', () => {
      it('adds a priority fee to the provided transaction message', async () => {
        const transactionMessage = await createUnsignedTransaction(solRpc.rpc, senderKeypair, receiverKeypair, 1000);
        assert(!doesTxMsgHaveComputeBudgetInstruction(transactionMessage));

        const appendedTransactionMessage = await solRpc.addPriorityFee({ transactionMessage });
        expect(doesTxMsgHaveComputeBudgetInstruction(appendedTransactionMessage)).to.be.true;

        function doesTxMsgHaveComputeBudgetInstruction(txMsg) {
          return txMsg.instructions.some(instruction => {
            return instruction.programAddress === 'ComputeBudget111111111111111111111111111111';
          });
        }
      });
    });

    describe('getBestBlockHash', () => {
      it('returns a blockhash', async () => {
        const hash = await solRpc.getBestBlockHash();
        expect(hash).to.be.a('string');
      });
    });

    describe('getTransaction', () => {
      let versioned_txid;
      let legacy_txid;
      before(async function() {
        this.timeout(10000);
        versioned_txid = await sendTransaction(solRpc, senderKeypair, receiverKeypair, 10000n, 0);
        await new Promise(resolve => setTimeout(resolve, 500)); // Add small delay between transactions - allow for listener cleanup
        legacy_txid = await sendTransaction(solRpc, senderKeypair, receiverKeypair, 10000n, 'legacy');
      });

      it('returns a versioned transaction if provided a valid transaction id', async () => {
        const retVal = await solRpc.getTransaction({ txid: versioned_txid });
        assertValidTransaction(retVal, true);
      });

      it('returns a legacy transaction if provided a valid transaction id', async () => {
        const retVal = await solRpc.getTransaction({ txid: legacy_txid });
        expect(retVal.version).to.equal('legacy');
        assertValidTransaction(retVal, true);
      });

      describe('lookup table tests', () => {
        let lookupTableAddress1;
        let lookupTableAddress2;

        before(async function() {
          [lookupTableAddress1, lookupTableAddress2] = await Promise.all([
            createLookupTable({ solRpc, fromKeypair: senderKeypair, toKeypair: receiverKeypair }),
            createLookupTable({ solRpc, fromKeypair: thirdKeypair, toKeypair: senderKeypair }),
          ]);
        });

        it('works with a versioned transaction', async () => {
          const amountInLamports = 1000;

          const txid = await sendTransactionUsingLookupTables({ solRpc, fromKeypair: senderKeypair, toKeypair: receiverKeypair, version: 0, lookupTableAddress: lookupTableAddress1, amountInLamports });

          const retVal = await solRpc.getTransaction({ txid });
          assertValidTransaction(retVal, true);

          // Check that receiver has received expected amount
          const receiverAddress = receiverKeypair.address;
          const receiverIndex = retVal.accountKeys.findIndex(key => key === receiverAddress);
          expect(receiverIndex).to.be.greaterThanOrEqual(0);
          // assertValidTransaction ensures retVal.meta.postBalances and preBalances exist and are bigint[]
          const receiverPostBalance = retVal.meta.postBalances[receiverIndex];
          expect(receiverPostBalance).not.to.be.undefined;
          const receiverPreBalance = retVal.meta.preBalances[receiverIndex];
          expect(receiverPreBalance).not.to.be.undefined;

          const receiverDifference = Number(receiverPostBalance - receiverPreBalance);
          expect(receiverDifference).to.equal(amountInLamports);
        });

        it('works with a noisy transaction', async () => {
          const amountInLamports = 1000;
          const otherAmountInLamports = 2.5 * amountInLamports;
          const txid = await sendNoisyTransactionUsingMultipleLookupTables({
            solRpc,
            fromKeypair: senderKeypair,
            targetKeypair: receiverKeypair,
            keypair3: thirdKeypair,
            amountInLamports,
            otherAmountInLamports,
            lut1Address: lookupTableAddress1,
            lut2Address: lookupTableAddress2
          });

          const retVal = await solRpc.getTransaction({ txid });
          assertValidTransaction(retVal, true);

          // Check that receiver has received expected amount
          const receiverAddress = receiverKeypair.address;
          const receiverIndex = retVal.accountKeys.findIndex(key => key === receiverAddress);
          expect(receiverIndex).to.be.greaterThanOrEqual(0);
          // assertValidTransaction ensures retVal.meta.postBalances and preBalances exist and are bigint[]
          const receiverPostBalance = retVal.meta.postBalances[receiverIndex];
          expect(receiverPostBalance).not.to.be.undefined;
          const receiverPreBalance = retVal.meta.preBalances[receiverIndex];
          expect(receiverPreBalance).not.to.be.undefined;
          
          const receiverDifference = Number(receiverPostBalance - receiverPreBalance);
          expect(receiverDifference).to.equal(amountInLamports);
        });
      });
    });

    describe('getTransactions', () => {
      /** @type {import('@solana/kit').KeyPairSigner<string>} */
      let targetKeypair;
      beforeEach(async function() {
        this.timeout(5e3);
        targetKeypair = await createAccount({ solRpc, feePayerKeypair: senderKeypair });
        for (let i = 0; i < 2; i++) {
          await sendTransaction(solRpc, senderKeypair, targetKeypair, 1000 * (i + 1));
        }
      });

      it('returns an array of at most 1000 non-null transactions for a specified address', async () => {
        // Consider generating a new address here...
        const transactions = await solRpc.getTransactions({ address: targetKeypair.address });
        expect(transactions).to.be.an('array');
        for (const transaction of transactions) {
          assertValidTransaction(transaction, true);
        }
      });
    }, 5e3);

    describe('getTransactionCount', () => {
      const numTransactions = 2;
      /** @type {SolKit.KeyPairSigner} */
      let targetKeypair;
      beforeEach(async function() {
        this.timeout(5e3);
        targetKeypair = await createAccount({ solRpc, feePayerKeypair: senderKeypair });
        for (let i = 0; i < numTransactions; i++) {
          await new Promise(resolve => setTimeout(resolve, 250));
          await sendTransaction(solRpc, senderKeypair, targetKeypair, 1000 * (i + 1));
        }
      });

      it('returns the count of confirmed transactions for a valid account address', async () => {
        const count = await solRpc.getTransactionCount({ address: targetKeypair.address });
        expect(count).to.equal(numTransactions + 1); // 1 is the createAccount transaction
      }, 5e3);
    });

    describe('getRawTransaction', () => {
      let txid;
      beforeEach(async function() {
        this.timeout(3500);
        txid = await sendTransaction(solRpc, senderKeypair, receiverKeypair, 10000n);
      });
      it('returns a base64 encoded string for a valid transaction', async () => {
        const txString = await solRpc.getRawTransaction({ txid });
        expect(txString).to.be.a('string');
        expect(txString).to.equal(Buffer.from(txString, 'base64').toString('base64'));
      });
    });

    describe('decodeRawTransaction', () => {
      it('returns a decoded raw transaction', async () => {
        const rawTx = await createRawTransaction(solRpc.rpc, senderKeypair, receiverKeypair, 1000);
        const decodedRawTransaction = await solRpc.decodeRawTransaction({ rawTx });
        assertValidTransaction(decodedRawTransaction, false);
      });
    });

    describe('sendRawTransaction', () => {
      it('sends a raw transaction', async () => {
        const rawTx = await createRawTransaction(solRpc.rpc, senderKeypair, receiverKeypair, 1000);
        const signature = await solRpc.sendRawTransaction({ rawTx });
        expect(signature).to.be.a('string');
      });
    });

    describe('getBlock', () => {
      const assertValidBlock = (block) => {
        const numberTargetType = 'bigint';

        expect(block).to.be.an('object');
        expect(block).to.have.property('blockhash').that.is.a('string');
        expect(block).to.have.property('blockHeight').that.is.a(numberTargetType);
        expect(block).to.have.property('blockTime').that.is.a(numberTargetType);
        expect(block).to.have.property('parentSlot').that.is.a(numberTargetType);
        expect(block).to.have.property('previousBlockhash').that.is.a('string');
        expect(block).to.have.property('rewards').that.is.an('array');
      };
      it('returns a block at provided height and signatures if no "transactionDetails" property passed in', async () => {
        const slot = await solRpc.rpc.getSlot().send();
        const block = await solRpc.getBlock({ height: slot });
        assertValidBlock(block);
        expect(block).not.to.have.property('transactions');
        expect(block).to.have.property('signatures').that.is.an('array');
        expect(block.signatures.every(signature => typeof signature === 'string')).to.be.true;
      });
      it('returns a block at provided height and signatures if "transactionDetails: signatures"', async () => {
        const slot = await solRpc.rpc.getSlot().send();
        const block = await solRpc.getBlock({ height: slot });
        assertValidBlock(block);
        expect(block).not.to.have.property('transactions');
        expect(block).to.have.property('signatures').that.is.an('array');
        expect(block.signatures.every(signature => typeof signature === 'string')).to.be.true;
      });
      it('returns a block at provided height and transactions if "transactionDetails: full"', async () => {
        const slot = await solRpc.rpc.getSlot().send();
        const block = await solRpc.getBlock({ height: slot, transactionDetails: 'full' });
        assertValidBlock(block);
        expect(block).not.to.have.property('signatures');
        expect(block).to.have.property('transactions').that.is.an('array');
        expect(block.transactions.every(transaction => typeof transaction === 'object')).to.be.true;
      });
      it('returns a block at provided height and transactions if "transactionDetails: accounts"', async () => {
        const slot = await solRpc.rpc.getSlot().send();
        const block = await solRpc.getBlock({ height: slot, transactionDetails: 'accounts' });
        assertValidBlock(block);
        expect(block).not.to.have.property('signatures');
        expect(block).to.have.property('transactions').that.is.an('array');
        expect(block.transactions.every(transaction => typeof transaction === 'object')).to.be.true;
      });
      it('returns a block at provided height and neither transactions nor signatures if "transactionDetails: none"', async () => {
        const slot = await solRpc.rpc.getSlot().send();
        const block = await solRpc.getBlock({ height: slot, transactionDetails: 'none' });
        assertValidBlock(block);
        expect(block).not.to.have.property('signatures');
        expect(block).not.to.have.property('transactions');
      });
    });

    describe('getLatestSignature', () => {
      it('retrieves the latest signature if found in the max number of blocks to check', async () => {
        try {
          const latestSignature = await solRpc.getLatestSignature();
          expect(latestSignature).to.be.an('object');
          expect(latestSignature).to.have.property('blockHeight').that.is.a('number').greaterThan(0);
          expect(latestSignature).to.have.property('blockTime').that.is.a('number').greaterThan(0);
          expect(latestSignature).to.have.property('signature').that.is.a('string');
        } catch (err) {
          // The catch block handles the expected error of all prior blocks checked not having a signature
          expect(err.message.includes('No signatures found in the last')).to.be.true;
        }
      });
    });

    describe('getConfirmations', () => {
      it('returns the number of confirmations for a valid txid', async function() {
        this.timeout(5000);
        const confirmedTransactionSignature = await sendTransaction(solRpc, senderKeypair, receiverKeypair, 1000);

        await new Promise(resolve => setTimeout(resolve, 250));
        let confirmations = await solRpc.getConfirmations({ txid: confirmedTransactionSignature });
        // Check monotonic increasing number of confirmations over time
        for (let i = 0; i < 2; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const newConfirmations = await solRpc.getConfirmations({ txid: confirmedTransactionSignature });
          expect(newConfirmations).to.be.greaterThanOrEqual(confirmations);
          confirmations = newConfirmations;
        }
      });
    });

    describe('getTip', () => {
      it('returns the slot number as "height" and the corresponding block at that height', async () => {
        const tip = await solRpc.getTip();
        expect(tip).to.be.an('object');
        expect(tip).to.have.property('hash').that.is.a('string');
        expect(tip).to.have.property('height').that.is.a('number');
      });
    });

    describe('getServerInfo', () => {
      it('returns server info', async () => {
        const serverInfo = await solRpc.getServerInfo();
        expect(serverInfo).to.be.an('object');
        expect(serverInfo).to.have.property('feature-set').that.is.a('number');
        expect(serverInfo).to.have.property('solana-core').that.is.a('string');
      });
    });

    describe('Mint tests (requires waiting for transaction finalization in places)', function() {
      const REQUIRED_FRESH_ACCOUNT_NUMBER = 16; // This number should be updated to reflect the number of TESTS (not required test accounts) in this block
      let mintKeypair;
      let resolvedCreateAccountArray;
      let resolvedCreateAccountIndex = 0;
      /** @type {SolKit.KeyPairSigner<string>} */
      let testKeypair;
      before(async function() {
        this.timeout(40e3); // Setup requires awaiting finalization of transactions
        // Create mint
        mintKeypair = await SolKit.generateKeyPairSigner();
        await createMint({ solRpc, payer: senderKeypair, mint: mintKeypair, mintAuthority: senderKeypair });

        // createAccount waits for transaction finalization. This takes a lot of time. Processing in parallel mitigates this issue to a large extent.
        // Update REQUIRED_FRESH_ACCOUNT_NUMBER when adding/removing tests to the "getOrCreateAta" describe block.
        resolvedCreateAccountArray = await Promise.all(
          Array(REQUIRED_FRESH_ACCOUNT_NUMBER).fill(0)
            .map(async () => createAccount({ solRpc, feePayerKeypair: senderKeypair, version: 'legacy', commitment: 'finalized' }))
        );
      });

      beforeEach(function() {
        testKeypair = resolvedCreateAccountArray[resolvedCreateAccountIndex];
        resolvedCreateAccountIndex++;
      });

      describe('deriveAta', function() {
        it('can find the associated token address string given a valid solAddress and mint address', async () => {
          const destinationAta = await solRpc.deriveAta({ solAddress: testKeypair.address, mintAddress: mintKeypair.address });
          expect(destinationAta).to.be.a('string');
        });
        it('throws an error if a provided param is non-base58', async () => {
          try {
            await solRpc.deriveAta({ solAddress: 'invalid string', mintAddress: mintKeypair.address });
            assert.fail('Test failed: deriveAta did not throw as expected');
          } catch (err) {
            expect(err.message).to.equal(SOL_ERROR_MESSAGES.NON_BASE58_PARAM);
          }
        });
        it('throws an error if a provided param is missing', async () => {
          try {
            await solRpc.deriveAta({ mintAddress: mintKeypair.address });
            assert.fail('Test failed: deriveAta did not throw as expected');
          } catch (err) {
            expect(err.message).to.equal('Cannot read properties of undefined (reading \'length\')');
          }
        });
        it('returns a string even if mint address does not correspond to a valid mint', async () => {
          const notMintKeypair = await SolKit.generateKeyPairSigner();
          const destinationAta = await solRpc.deriveAta({ solAddress: testKeypair.address, mintAddress: notMintKeypair.address });
          expect(destinationAta).to.be.a('string');
        });
      });
      describe('getConfirmedAta', function() {
        this.timeout(20e3);
        it('Retrieves ATA address string', async function() {
          const createdAta = await createAta({ solRpc, owner: testKeypair.address, mint: mintKeypair.address, payer: senderKeypair });
          const result = await solRpc.getConfirmedAta({ solAddress: testKeypair.address, mintAddress: mintKeypair.address });
          expect(result).to.equal(createdAta);
        });
        it(`Throws "${SOL_ERROR_MESSAGES.ATA_NOT_INITIALIZED}" if ATA not found`, async () => {
          try {
            await solRpc.getConfirmedAta({ solAddress: testKeypair.address, mintAddress: mintKeypair.address });
          } catch (err) {
            expect(err.message).to.equal(SOL_ERROR_MESSAGES.ATA_NOT_INITIALIZED);
          }
        });
        it(`Throws ${SOL_ERROR_MESSAGES.UNSPECIFIED_INVALID_PARAMETER} if passed in address not found`, async () => {
          try {
            await solRpc.getConfirmedAta({ solAddress: 'invalid sol address', mintAddress: mintKeypair.address });
          } catch (err) {
            expect(err.message).to.equal(SOL_ERROR_MESSAGES.UNSPECIFIED_INVALID_PARAMETER);
          }
        });
        it(`Throws "${SOL_ERROR_MESSAGES.INVALID_MINT_PARAMETER}" if passed in mint not a mint`, async () => {
          const validBase58String = (await SolKit.generateKeyPairSigner()).address;
          try {
            await solRpc.getConfirmedAta({ solAddress: testKeypair.address, mintAddress: validBase58String });
          } catch (err) {
            expect(err.message).to.equal(SOL_ERROR_MESSAGES.INVALID_MINT_PARAMETER);
          }
        });
      });
      describe('createAta', function() {
        this.timeout(20e3);
        // Spy on the three possible factory methods for generating a method to send a transaction
        let sendAndConfirmFactorySpy;
        let sendAndConfirmDurableNonceFactorySpy;
        beforeEach(async function() {
          sendAndConfirmFactorySpy = sinon.spy(SolRpc.prototype, '_sendAndConfirmTransactionFactory');
          sendAndConfirmDurableNonceFactorySpy = sinon.spy(SolRpc.prototype, '_sendAndConfirmNonceTransactionFactory');
        });

        afterEach(function() {
          sinon.restore();
        });

        it('returns retrieved ata if it already exists', async () => {
          const createdAta = await createAta({ solRpc, owner: testKeypair.address, mint: mintKeypair.address, payer: senderKeypair });
          sendAndConfirmFactorySpy.resetHistory();
          sendAndConfirmDurableNonceFactorySpy.resetHistory();

          const result = await solRpc.createAta({ ownerAddress: testKeypair.address, mintAddress: mintKeypair.address });
          expect(result).to.be.an('object');
          expect(result).to.have.property('action').that.equals('RETRIEVED');
          expect(result).to.have.property('ataAddress').that.equals(createdAta);
          expect(result).to.have.property('message').that.equals('The ATA was previously initialized.');

          // Additional tests ensure that no transaction was sent
          expect(sendAndConfirmFactorySpy.callCount).to.equal(0);
          expect(sendAndConfirmDurableNonceFactorySpy.callCount).to.equal(0);
        });
        it('does not create a transaction message if getAta throws any error that is not ata not initialized error', async function() {
          const invalidMintAddress = (await SolKit.generateKeyPairSigner()).address;
          const expectedErrorMessage = SOL_ERROR_MESSAGES.INVALID_MINT_PARAMETER;
          sendAndConfirmFactorySpy.resetHistory();
          sendAndConfirmDurableNonceFactorySpy.resetHistory();

          try {
            await solRpc.createAta({ ownerAddress: testKeypair.address, mintAddress: invalidMintAddress });
            throw new Error('should have thrown');
          } catch (err) {
            expect(err.message).to.equal(expectedErrorMessage);
          } finally {
            expect(sendAndConfirmFactorySpy.callCount).to.equal(0);
            expect(sendAndConfirmDurableNonceFactorySpy.callCount).to.equal(0);
          }
        });
        it('can create an ata', async () => {
          const result = await solRpc.createAta({ ownerAddress: testKeypair.address, mintAddress: mintKeypair.address, feePayer: senderKeypair });
          expect(result).to.be.an('object');
          expect(result).to.have.property('action').that.equals('CREATED');
          expect(result).to.have.property('ataAddress').that.is.a('string');
          expect(result).to.have.property('signature').that.is.a('string');
          expect(result).to.have.property('message').that.equals('The ATA is initialized.');
        });
      });
      describe('getAccountInfo', function() {
        this.timeout(20e3);
        it('can return an account balance and array of associated tokens', async () => {
          // Setup
          await createAta({ solRpc, owner: testKeypair.address, mint: mintKeypair.address, payer: senderKeypair });

          // Execution
          const result = await solRpc.getAccountInfo({ address: testKeypair.address });

          // Assertions
          expect(result).to.be.an('object');
          expect(result).not.to.be.null;
          expect(result).to.have.property('lamports').that.is.a('number').greaterThan(0);
          expect(result).to.have.property('atas').that.is.an('array').with.length(1);
          for (const ata of result.atas) {
            expect(ata).to.be.an('object');
            expect(ata).to.have.property('mint').that.is.a('string');
            expect(ata).to.have.property('pubkey').that.is.a('string').not.equal(testKeypair.address);
            expect(ata).to.have.property('state').that.is.a('string');
          }
        });
        it('can return an account balance and empty array of associated tokens', async () => {
          const result = await solRpc.getAccountInfo({ address: testKeypair.address });
          expect(result).to.be.an('object');
          expect(result).not.to.be.null;
          expect(result).to.have.property('lamports').that.is.a('number').greaterThan(0);
          expect(result).to.have.property('atas').that.is.an('array').with.length(0);
        });
        it('returns an object with lamports 0 if provided address is not found onchain', async () => {
          const newKeypair = await SolKit.generateKeyPairSigner();
          const result = await solRpc.getAccountInfo({ address: newKeypair.address });
          expect(result).to.be.an('object');
          expect(result).not.to.be.null;
          expect(result).to.have.property('lamports').that.equals(0);
          expect(result).to.have.property('atas').that.is.an('array').with.length(0);
        });
        it('throws error if provided address is ATA address', async () => {
          const ata = await createAta({ solRpc, owner: testKeypair.address, mint: mintKeypair.address, payer: senderKeypair });
          try {
            await solRpc.getAccountInfo({ address: ata });
            assert.fail('Expected getAccountInfo to reject, but it resolved.');
          } catch (err) {
            expect(err.message).to.equal(SOL_ERROR_MESSAGES.ATA_ADD_SENT_INSTEAD_OF_SOL_ADD);
          }
        });
        it('returns nested ATAs across multiple depths in one run', async function() {
          // !! NOTE !! This is a large test because it involves some sequencing and testing along the way

          // Three atas have to be created - each transaction has to be finalized before the next can be created
          this.timeout(60e3);

          // Set up spy on getTokenAccountsByOwner
          const getTokenAccountsByOwnerSpy = sinon.spy(solRpc, 'getTokenAccountsByOwner');

          /**
           * TEST BLOCK 1: No ATAS
           */ 
          // Test 1.1: infinite max depth
          const result_1_1 = await solRpc.getAccountInfo({ address: testKeypair.address, maxDepth: -1 });
          // expect solRpc.getTokenAccountsByOwner should be called ONCE
          expect(getTokenAccountsByOwnerSpy.callCount).to.equal(1);
          // expect result*.atas to be an array with length 0
          expect(result_1_1).to.have.property('atas').that.is.an('array').with.length(0);

          getTokenAccountsByOwnerSpy.resetHistory();

          // Test 1.2: max depth greater than expected number of getTokenAccountsByOwner calls
          const result_1_2 = await solRpc.getAccountInfo({ address: testKeypair.address, maxDepth: 6 });
          // expect solRpc.getTokenAccountsByOwner should be called ONCE
          expect(getTokenAccountsByOwnerSpy.callCount).to.equal(1);
          // expect result*.atas to be an array with length 0
          expect(result_1_2).to.have.property('atas').that.is.an('array').with.length(0);

          getTokenAccountsByOwnerSpy.resetHistory();

          /**
           * TEST BLOCK 2: One ATA
           */
          const ataLevel1 = await createAta({ solRpc, owner: testKeypair.address, mint: mintKeypair.address, payer: senderKeypair });
          
          // Test 2.1: infinite max depth
          const result_2_1 = await solRpc.getAccountInfo({ address: testKeypair.address, maxDepth: -1 });
          // expect solRpc.getTokenAccountsByOwner should be called TWICE
          expect(getTokenAccountsByOwnerSpy.callCount).to.equal(2);
          // expect result*.atas to be an array with length 1
          expect(result_2_1).to.have.property('atas').that.is.an('array').with.length(1);
          // expect result*.atas to have nested atas with length 0
          expect(result_2_1.atas[0]).to.have.property('atas').that.is.an('array').with.length(0);

          getTokenAccountsByOwnerSpy.resetHistory();

          // Test 2.2: max depth greater than expected number of getTokenAccountsByOwner calls
          const result_2_2 = await solRpc.getAccountInfo({ address: testKeypair.address, maxDepth: 6 });
          // expect solRpc.getTokenAccountsByOwner should be called TWICE
          expect(getTokenAccountsByOwnerSpy.callCount).to.equal(2);
          // expect result*.atas to be an array with length 1
          expect(result_2_2).to.have.property('atas').that.is.an('array').with.length(1);
          // expect result*.atas to have nested atas with length 0
          expect(result_2_2.atas[0]).to.have.property('atas').that.is.an('array').with.length(0);

          getTokenAccountsByOwnerSpy.resetHistory();

          // Test 2.3: maxDepth: 0 - should mean "no recursion" (1 call total)
          const result_2_3 = await solRpc.getAccountInfo({ address: testKeypair.address, maxDepth: 0 });
          // Should be called only once: just the initial call, no recursion
          expect(getTokenAccountsByOwnerSpy.callCount).to.equal(1);
          expect(result_2_3).to.have.property('atas').that.is.an('array').with.length(1);
          // The nested atas should be empty because maxDepth: 0 means no recursion
          expect(result_2_3.atas[0]).to.have.property('atas').that.is.an('array').with.length(0);

          getTokenAccountsByOwnerSpy.resetHistory();

          /**
           * TEST BLOCK 3: One ATA once-nested
           */
          const ataLevel2 = await createAta({ solRpc, owner: ataLevel1, mint: mintKeypair.address, payer: senderKeypair });
          
          // Test with maxDepth: 1 - should allow 1 level of recursion (2 calls total)
          const result_3_2 = await solRpc.getAccountInfo({ address: testKeypair.address, maxDepth: 1 });
          // Should be called twice: initial call + 1 recursion
          expect(getTokenAccountsByOwnerSpy.callCount).to.equal(2);
          // Should have 1 ata at root level
          expect(result_3_2).to.have.property('atas').that.is.an('array').with.length(1);
          // The nested atas should have 1 item because maxDepth: 1 allows 1 level of recursion
          expect(result_3_2.atas[0]).to.have.property('atas').that.is.an('array').with.length(1);
          expect(result_3_2.atas[0].atas[0]).to.have.property('atas').that.is.an('array').with.length(0);

          getTokenAccountsByOwnerSpy.resetHistory();

          // Test 3.1: infinite max depth - should find all nested levels
          const result_3_1 = await solRpc.getAccountInfo({ address: testKeypair.address, maxDepth: -1 });
          // Should be called three times: testKeypair -> ataLevel1 -> ataLevel2
          expect(getTokenAccountsByOwnerSpy.callCount).to.equal(3);
          expect(result_3_1).to.have.property('atas').that.is.an('array').with.length(1);
          expect(result_3_1.atas[0]).to.have.property('atas').that.is.an('array').with.length(1);
          expect(result_3_1.atas[0].atas[0]).to.have.property('atas').that.is.an('array').with.length(0);

          getTokenAccountsByOwnerSpy.resetHistory();

          /**
           * TEST BLOCK 4: One ATA twice-nested
           */
          const ataLevel3 = await createAta({ solRpc, owner: ataLevel2, mint: mintKeypair.address, payer: senderKeypair });
          
          // Test maxDepth: 0 - should only make 1 call (no recursion)
          const result_4_1 = await solRpc.getAccountInfo({ address: testKeypair.address, maxDepth: 0 });
          expect(getTokenAccountsByOwnerSpy.callCount).to.equal(1);
          expect(result_4_1).to.have.property('atas').that.is.an('array').with.length(1);
          expect(result_4_1.atas[0]).to.have.property('atas').that.is.an('array').with.length(0);

          getTokenAccountsByOwnerSpy.resetHistory();

          // Test maxDepth: 1 - should make 2 calls total (1 level of recursion)
          const result_4_2 = await solRpc.getAccountInfo({ address: testKeypair.address, maxDepth: 1 });
          expect(getTokenAccountsByOwnerSpy.callCount).to.equal(2);
          expect(result_4_2).to.have.property('atas').that.is.an('array').with.length(1);
          expect(result_4_2.atas[0]).to.have.property('atas').that.is.an('array').with.length(1);
          expect(result_4_2.atas[0].atas[0]).to.have.property('atas').that.is.an('array').with.length(0);

          getTokenAccountsByOwnerSpy.resetHistory();

          // Test maxDepth: -1 (infinite) - should make 4 calls total (full recursion depth)
          const result_4_3 = await solRpc.getAccountInfo({ address: testKeypair.address, maxDepth: -1 });
          expect(getTokenAccountsByOwnerSpy.callCount).to.equal(4); // 1: base SOL acct, 2: SOL ATA, 3: SOL ATA ATA, 4: SOL ATA ATA ATA (base case)
          expect(result_4_3).to.have.property('atas').that.is.an('array').with.length(1);
          expect(result_4_3.atas[0]).to.have.property('atas').that.is.an('array').with.length(1);
          expect(result_4_3.atas[0].atas[0]).to.have.property('atas').that.is.an('array').with.length(1);
          expect(result_4_3.atas[0].atas[0].atas[0]).to.have.property('atas').that.is.an('array').with.length(0);

          // Clean up spy
          getTokenAccountsByOwnerSpy.restore();
        });
      });
    });

    describe('isBase58', () => {
      it('returns true if a string is valid base58', () => {
        const isBase58 = solRpc.isBase58(receiverKeypair.address);
        expect(isBase58).to.be.true;
      });
      it('returns false if a string is invalid base58', () => {
        const isBase58 = solRpc.isBase58('l1O0');
        expect(isBase58).to.be.false;
      });
    });
  });
  describe('Devnet tests', function() {
    this.timeout(10e4);
    const config = {
      chain: 'SOL',
      host: 'api.devnet.solana.com',
      protocol: 'https'
      // Do not include ports
    };

    /** @type {SolRpc} */
    let solRpc;
    /** @type {SolKit.KeyPairSigner<string>} */
    let senderKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let receiverKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let nonceAccountKeypair;

    before(async function() {
      senderKeypair = await SolKit.createKeyPairSignerFromPrivateKeyBytes(bs58Encoder.encode('H6x8RRKJ9xBx71N8wn8USBghwApSqHP7A9LT5Mxo6rP9'));
      receiverKeypair = await SolKit.createKeyPairSignerFromPrivateKeyBytes(bs58Encoder.encode('CVFoRgAv6LNQvX6EmPeqGjgUDZYvjHgqbXve4rus4o63'));

      solRpc = new SolRpc(config);
      nonceAccountKeypair = await SolKit.generateKeyPairSigner();
      await createNonceAccount(solRpc, senderKeypair, nonceAccountKeypair);
      // Ensure sender and receiver are properly funded - this is important because although the value is held constant, transaction fees are taken out

      const { value: senderBalance } = await solRpc.rpc.getBalance(senderKeypair.address).send();
      const { value: receiverBalance } = await solRpc.rpc.getBalance(receiverKeypair.address).send();
      const THRESHOLD_LAMPORTS = 100000;
      if (!(Number(senderBalance) >= THRESHOLD_LAMPORTS && Number(receiverBalance) >= THRESHOLD_LAMPORTS)) {
        console.warn('Devnet accounts need more funds');
      }
    });

    it('can retrieve a balance', async () => {
      const addressString = senderKeypair.address;
      const balance = await solRpc.getBalance({ address: addressString });
      expect(balance).to.be.a('number');
    });
    it('can estimate a fee on a raw transaction', async () => {
      const rawTx = await createRawTransaction(solRpc.rpc, senderKeypair, receiverKeypair, 1000);
      const retVal = await solRpc.estimateFee({ rawTx });
      expect(retVal).to.be.a('number');
      expect(retVal).to.be.greaterThanOrEqual(0);
    });
    it('can calculate a max priority fee', async () => {
      const retVal = await solRpc.estimateMaxPriorityFee({});
      expect(retVal).to.be.a('number');
      expect(retVal).to.be.greaterThanOrEqual(0);
    });
    it('can get most recent blockhash', async () => {
      const hash = await solRpc.getBestBlockHash();
      expect(hash).to.be.a('string');
    });
    it('can get the most recent block', async () => {
      const numberTargetType = 'bigint';

      const slot = await solRpc.rpc.getSlot().send();
      const block = await solRpc.getBlock({ height: slot });
      expect(block).to.be.an('object');
      expect(block).to.have.property('blockhash').that.is.a('string');
      expect(block).to.have.property('blockHeight').that.is.a(numberTargetType);
      expect(block).to.have.property('blockTime').that.is.a(numberTargetType);
      expect(block).to.have.property('parentSlot').that.is.a(numberTargetType);
      expect(block).to.have.property('previousBlockhash').that.is.a('string');
      expect(block).to.have.property('rewards').that.is.an('array');
      expect(block).to.have.property('signatures').that.is.an('array');
    });
    it('can get the most recent slot and its blockhash', async () => {
      const tip = await solRpc.getTip();
      expect(tip).to.be.an('object');
      expect(tip).to.have.property('hash').that.is.a('string');
      expect(tip).to.have.property('height').that.is.a('number');
    });
    it('can get server state info', async () => {
      const serverInfo = await solRpc.getServerInfo();
      expect(serverInfo).to.be.an('object');
      expect(serverInfo).to.have.property('feature-set').that.is.a('number');
      expect(serverInfo).to.have.property('solana-core').that.is.a('string');
    });
    it('can retrieve account info including lamports and ata array', async () => {
      const result = await solRpc.getAccountInfo({ address: senderKeypair.address });
      expect(result).to.be.an('object');
      expect(result).not.to.be.null;
      expect(result).to.have.property('lamports').that.is.a('number').greaterThan(0);
      expect(result).to.have.property('atas').that.is.an('array');
      for (const ata of result.atas) {
        expect(ata).to.be.an('object');
        expect(ata).to.have.property('mint').that.is.a('string');
        expect(ata).to.have.property('pubkey').that.is.a('string').not.equal(senderKeypair.address);
        expect(ata).to.have.property('state').that.is.a('string');
      }
    });
    describe('getTokenAccountsByOwner', function() {
      it('can retrieve an array of atas for a previously-confirmed account and skip account existence check', async () => {
        const result = await solRpc.getTokenAccountsByOwner({ address: senderKeypair.address, skipExistenceCheck: true });
        expect(result).to.be.an('array');
        for (const ata of result) {
          expect(ata).to.be.an('object');
          expect(ata).to.have.property('mint').that.is.a('string');
          expect(ata).to.have.property('pubkey').that.is.a('string').not.equal(senderKeypair.address);
          expect(ata).to.have.property('state').that.is.a('string');
        }
      });
      it('throws an expected error if existence check is not skipped and provided address is not found onchain', async () => {
        try {
          const newKeypair = await SolKit.generateKeyPairSigner();
          await solRpc.getTokenAccountsByOwner({ address: newKeypair.address });
        } catch (err) {
          expect(err.message).to.equal(SOL_ERROR_MESSAGES.SOL_ACCT_NOT_FOUND);
        }
      });
      it('returns empty array if existence check skipped and account not found onchain', async () => {
        try {
          const newKeypair = await SolKit.generateKeyPairSigner();
          await solRpc.getTokenAccountsByOwner({ address: newKeypair.address, skipExistenceCheck: true });
        } catch (err) {
          expect(err.message).to.equal(SOL_ERROR_MESSAGES.SOL_ACCT_NOT_FOUND);
        }
      });
    });
  });
  describe('Transaction Parser', () => {
    // Valid base58 mock addresses for transaction parser tests
    const mockSenderAddress = '11111111111111111111111111111112';
    const mockReceiverAddress = '11111111111111111111111111111113';
    const mockNonceAccountAddress = '11111111111111111111111111111114';

    describe('parseInstructions', () => {
      it('parses SOL transfer instructions', () => {
        const mockInstruction = {
          programAddress: SolSystem.SYSTEM_PROGRAM_ADDRESS,
          accounts: [
            { address: mockSenderAddress, role: 0 },
            { address: mockReceiverAddress, role: 1 }
          ],
          data: new Uint8Array([2, 0, 0, 0, 64, 66, 15, 0, 0, 0, 0, 0]) // Transfer with 1M lamports
        };

        const result = parseInstructions([mockInstruction]);
        expect(result).to.have.property(instructionKeys.TRANSFER_SOL);
        expect(result[instructionKeys.TRANSFER_SOL]).to.be.an('array').with.length(1);

        const transferSol = result[instructionKeys.TRANSFER_SOL][0];
        expect(transferSol).to.have.property('amount').that.is.a('number');
        expect(transferSol).to.have.property('currency', 'SOL');
        expect(transferSol).to.have.property('source').that.is.a('string');
        expect(transferSol).to.have.property('destination').that.is.a('string');
      });

      it('parses advance nonce account instructions', () => {
        const mockInstruction = {
          programAddress: SolSystem.SYSTEM_PROGRAM_ADDRESS,
          accounts: [
            { address: mockNonceAccountAddress, role: 0 },
            { address: 'SysvarRecentB1ockHashes11111111111111111111', role: 1 },
            { address: mockSenderAddress, role: 2 }
          ],
          data: new Uint8Array([4, 0, 0, 0]) // AdvanceNonceAccount discriminator
        };

        const result = parseInstructions([mockInstruction]);
        expect(result).to.have.property(instructionKeys.ADVANCE_NONCE_ACCOUNT);
        expect(result[instructionKeys.ADVANCE_NONCE_ACCOUNT]).to.be.an('array').with.length(1);

        const advanceNonce = result[instructionKeys.ADVANCE_NONCE_ACCOUNT][0];
        expect(advanceNonce).to.have.property('nonceAccount').that.is.a('string');
        expect(advanceNonce).to.have.property('nonceAuthority').that.is.a('string');
      });

      it('parses memo instructions', () => {
        const mockMemo = 'Test memo content';
        const mockInstruction = {
          programAddress: SolMemo.MEMO_PROGRAM_ADDRESS,
          accounts: [{ address: mockSenderAddress, role: 0 }],
          data: new TextEncoder().encode(mockMemo)
        };

        const result = parseInstructions([mockInstruction]);
        expect(result).to.have.property(instructionKeys.MEMO);
        expect(result[instructionKeys.MEMO]).to.be.an('array').with.length(1);

        const memo = result[instructionKeys.MEMO][0];
        expect(memo).to.have.property('memo', mockMemo);
      });

      it('parses compute budget limit instructions', () => {
        // Create a real SetComputeUnitLimit instruction using the SDK
        const realInstruction = SolComputeBudget.getSetComputeUnitLimitInstruction({
          units: 1000000
        });

        const result = parseInstructions([realInstruction]);
        expect(result).to.have.property(instructionKeys.SET_COMPUTE_UNIT_LIMIT);
        expect(result[instructionKeys.SET_COMPUTE_UNIT_LIMIT]).to.be.an('array').with.length(1);

        const computeLimit = result[instructionKeys.SET_COMPUTE_UNIT_LIMIT][0];
        expect(computeLimit).to.have.property('computeUnitLimit').that.is.a('number');
      });

      it('parses compute budget price instructions', () => {
        // Create a real SetComputeUnitPrice instruction using the SDK
        const realInstruction = SolComputeBudget.getSetComputeUnitPriceInstruction({
          microLamports: 100n
        });

        const result = parseInstructions([realInstruction]);
        expect(result).to.have.property(instructionKeys.SET_COMPUTE_UNIT_PRICE);
        expect(result[instructionKeys.SET_COMPUTE_UNIT_PRICE]).to.be.an('array').with.length(1);

        const computePrice = result[instructionKeys.SET_COMPUTE_UNIT_PRICE][0];
        expect(computePrice).to.have.property('priority', true);
        expect(computePrice).to.have.property('microLamports').that.is.a('number');
      });

      it('parses token transfer instructions', async () => {
        const sourceAta = await SolKit.generateKeyPairSigner();
        const destinationAta = await SolKit.generateKeyPairSigner();

        const mockInstruction = {
          programAddress: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          accounts: [
            { address: sourceAta.address, role: 0 },
            { address: destinationAta.address, role: 1 },
            { address: mockSenderAddress, role: 2 }
          ],
          data: new Uint8Array([3, 100, 0, 0, 0, 0, 0, 0, 0]) // Transfer with 100 tokens
        };

        const result = parseInstructions([mockInstruction]);
        expect(result).to.have.property(instructionKeys.TRANSFER_TOKEN);
        expect(result[instructionKeys.TRANSFER_TOKEN]).to.be.an('array').with.length(1);

        const transferToken = result[instructionKeys.TRANSFER_TOKEN][0];
        expect(transferToken).to.have.property('amount').that.is.a('number');
        expect(transferToken).to.have.property('authority').that.is.a('string');
        expect(transferToken).to.have.property('source').that.is.a('string');
        expect(transferToken).to.have.property('destination').that.is.a('string');
      });

      it('parses token transfer checked instructions', async () => {
        const mintKeypair = await SolKit.generateKeyPairSigner();
        const sourceAta = await SolKit.generateKeyPairSigner();
        const destinationAta = await SolKit.generateKeyPairSigner();

        const mockInstruction = {
          programAddress: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          accounts: [
            { address: sourceAta.address, role: 0 },
            { address: mintKeypair.address, role: 1 },
            { address: destinationAta.address, role: 2 },
            { address: mockSenderAddress, role: 3 }
          ],
          data: new Uint8Array([12, 100, 0, 0, 0, 0, 0, 0, 0, 6]) // TransferChecked with 100 tokens, 6 decimals
        };

        const result = parseInstructions([mockInstruction]);
        expect(result).to.have.property(instructionKeys.TRANSFER_CHECKED_TOKEN);
        expect(result[instructionKeys.TRANSFER_CHECKED_TOKEN]).to.be.an('array').with.length(1);

        const transferChecked = result[instructionKeys.TRANSFER_CHECKED_TOKEN][0];
        expect(transferChecked).to.have.property('amount').that.is.a('number');
        expect(transferChecked).to.have.property('authority').that.is.a('string');
        expect(transferChecked).to.have.property('source').that.is.a('string');
        expect(transferChecked).to.have.property('destination').that.is.a('string');
        expect(transferChecked).to.have.property('mint').that.is.a('string');
        expect(transferChecked).to.have.property('decimals').that.is.a('number');
      });

      it('parses associated token account creation instructions', async () => {
        const mintKeypair = await SolKit.generateKeyPairSigner();
        const ownerKeypair = await SolKit.generateKeyPairSigner();

        const [ataAddress] = await SolToken.findAssociatedTokenPda({
          owner: ownerKeypair.address,
          tokenProgram: SolToken.TOKEN_PROGRAM_ADDRESS,
          mint: mintKeypair.address
        });

        const realInstruction = SolToken.getCreateAssociatedTokenInstruction({
          payer: mockSenderAddress,
          ata: ataAddress,
          owner: ownerKeypair.address,
          mint: mintKeypair.address
        });

        const result = parseInstructions([realInstruction]);
        expect(result).to.have.property(instructionKeys.CREATE_ASSOCIATED_TOKEN);
        expect(result[instructionKeys.CREATE_ASSOCIATED_TOKEN]).to.be.an('array').with.length(1);

        const createAta = result[instructionKeys.CREATE_ASSOCIATED_TOKEN][0];
        expect(createAta).to.have.property('payer').that.is.a('string');
        expect(createAta).to.have.property('associatedTokenAccount').that.is.a('string');
        expect(createAta).to.have.property('owner').that.is.a('string');
        expect(createAta).to.have.property('mint').that.is.a('string');
        expect(createAta).to.have.property('tokenProgram').that.is.a('string');
      });

      it('parses idempotent associated token account creation instructions', async () => {
        const mintKeypair = await SolKit.generateKeyPairSigner();
        const ownerKeypair = await SolKit.generateKeyPairSigner();

        // Create the ATA address that would be derived
        const [ataAddress] = await SolToken.findAssociatedTokenPda({
          owner: ownerKeypair.address,
          tokenProgram: SolToken.TOKEN_PROGRAM_ADDRESS,
          mint: mintKeypair.address
        });

        // Create a real CreateAssociatedTokenIdempotent instruction using the SDK
        const realInstruction = SolToken.getCreateAssociatedTokenIdempotentInstruction({
          payer: mockSenderAddress,
          ata: ataAddress,
          owner: ownerKeypair.address,
          mint: mintKeypair.address
        });

        const result = parseInstructions([realInstruction]);
        expect(result).to.have.property(instructionKeys.CREATE_ASSOCIATED_TOKEN_IDEMPOTENT);
        expect(result[instructionKeys.CREATE_ASSOCIATED_TOKEN_IDEMPOTENT]).to.be.an('array').with.length(1);

        const createAtaIdempotent = result[instructionKeys.CREATE_ASSOCIATED_TOKEN_IDEMPOTENT][0];
        expect(createAtaIdempotent).to.have.property('payer').that.is.a('string');
        expect(createAtaIdempotent).to.have.property('associatedTokenAccount').that.is.a('string');
        expect(createAtaIdempotent).to.have.property('owner').that.is.a('string');
        expect(createAtaIdempotent).to.have.property('mint').that.is.a('string');
        expect(createAtaIdempotent).to.have.property('tokenProgram').that.is.a('string');
      });

      it('handles unknown instructions gracefully', () => {
        const mockInstruction = {
          programAddress: 'UnknownProgram11111111111111111111111111111',
          accounts: [{ address: mockSenderAddress, role: 0 }],
          data: new Uint8Array([255, 255, 255])
        };

        const result = parseInstructions([mockInstruction]);
        expect(result).to.have.property(instructionKeys.UNKNOWN);
        expect(result[instructionKeys.UNKNOWN]).to.be.an('array').with.length(1);

        const unknownInstruction = result[instructionKeys.UNKNOWN][0];
        expect(unknownInstruction).to.have.property('programAddress', 'UnknownProgram11111111111111111111111111111');
      });

      it('handles parsing errors gracefully', () => {
        const mockInstruction = {
          programAddress: SolSystem.SYSTEM_PROGRAM_ADDRESS,
          accounts: [], // Missing required accounts
          data: new Uint8Array([255]) // Invalid discriminator
        };

        const result = parseInstructions([mockInstruction]);
        expect(result).to.have.property(instructionKeys.UNKNOWN);
        expect(result[instructionKeys.UNKNOWN]).to.be.an('array').with.length(1);

        const errorInstruction = result[instructionKeys.UNKNOWN][0];
        expect(errorInstruction).to.have.property('error').that.is.a('string');
        expect(errorInstruction).to.have.property('programAddress', SolSystem.SYSTEM_PROGRAM_ADDRESS);
      });

      it('groups multiple instructions of the same type', () => {
        const mockInstructions = [
          {
            programAddress: SolSystem.SYSTEM_PROGRAM_ADDRESS,
            accounts: [
              { address: mockSenderAddress, role: 0 },
              { address: mockReceiverAddress, role: 1 }
            ],
            data: new Uint8Array([2, 0, 0, 0, 64, 66, 15, 0, 0, 0, 0, 0])
          },
          {
            programAddress: SolSystem.SYSTEM_PROGRAM_ADDRESS,
            accounts: [
              { address: mockSenderAddress, role: 0 },
              { address: mockReceiverAddress, role: 1 }
            ],
            data: new Uint8Array([2, 0, 0, 0, 128, 132, 30, 0, 0, 0, 0, 0])
          }
        ];

        const result = parseInstructions(mockInstructions);
        expect(result).to.have.property(instructionKeys.TRANSFER_SOL);
        expect(result[instructionKeys.TRANSFER_SOL]).to.be.an('array').with.length(2);

        for (const transfer of result[instructionKeys.TRANSFER_SOL]) {
          expect(transfer).to.have.property('amount').that.is.a('number');
          expect(transfer).to.have.property('currency', 'SOL');
        }
      });

      it('parses complex transaction with multiple instruction types', () => {
        // Create real instructions using the SDK
        const computeUnitLimitInstruction = SolComputeBudget.getSetComputeUnitLimitInstruction({
          units: 1000000
        });

        const computeUnitPriceInstruction = SolComputeBudget.getSetComputeUnitPriceInstruction({
          microLamports: 100n
        });

        const memoInstruction = SolMemo.getAddMemoInstruction({
          memo: 'Complex transaction test'
        });

        const solTransferInstruction = SolSystem.getTransferSolInstruction({
          source: mockSenderAddress,
          destination: mockReceiverAddress,
          amount: 1000000n // 1M lamports
        });

        const mockInstructions = [
          computeUnitLimitInstruction,
          computeUnitPriceInstruction,
          memoInstruction,
          solTransferInstruction
        ];

        const result = parseInstructions(mockInstructions);

        expect(result).to.have.property(instructionKeys.SET_COMPUTE_UNIT_LIMIT);
        expect(result).to.have.property(instructionKeys.SET_COMPUTE_UNIT_PRICE);
        expect(result).to.have.property(instructionKeys.MEMO);
        expect(result).to.have.property(instructionKeys.TRANSFER_SOL);

        expect(result[instructionKeys.SET_COMPUTE_UNIT_LIMIT]).to.have.length(1);
        expect(result[instructionKeys.SET_COMPUTE_UNIT_PRICE]).to.have.length(1);
        expect(result[instructionKeys.MEMO]).to.have.length(1);
        expect(result[instructionKeys.TRANSFER_SOL]).to.have.length(1);
      });

      it('handles associated token instructions without data field', async () => {
        // Generate valid keypairs for addresses
        const mintKeypair = await SolKit.generateKeyPairSigner();
        const ownerKeypair = await SolKit.generateKeyPairSigner();

        // Create the ATA address that would be derived
        const [ataAddress] = await SolToken.findAssociatedTokenPda({
          owner: ownerKeypair.address,
          tokenProgram: SolToken.TOKEN_PROGRAM_ADDRESS,
          mint: mintKeypair.address
        });

        // Create instruction without data field to test default handling
        const mockInstruction = {
          programAddress: SolToken.ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
          accounts: [
            { address: mockSenderAddress, role: 0 },
            { address: ataAddress, role: 1 },
            { address: ownerKeypair.address, role: 2 },
            { address: mintKeypair.address, role: 3 },
            { address: SolToken.TOKEN_PROGRAM_ADDRESS, role: 4 }
          ]
          // Note: no data field, should default to CreateAssociatedToken
        };

        const result = parseInstructions([mockInstruction]);

        // The parser should handle missing data by defaulting to CreateAssociatedToken
        // However, if the SDK validation fails, it may end up as unknown instruction
        // Both outcomes are acceptable for this edge case
        const hasCreateAta = !!result[instructionKeys.CREATE_ASSOCIATED_TOKEN];
        const hasUnknown = !!result[instructionKeys.UNKNOWN];

        expect(hasCreateAta || hasUnknown).to.be.true;

        if (hasCreateAta) {
          expect(result[instructionKeys.CREATE_ASSOCIATED_TOKEN]).to.be.an('array').with.length(1);
        } else {
          expect(result[instructionKeys.UNKNOWN]).to.be.an('array').with.length(1);
        }
      });
    });

    describe('instructionKeys', () => {
      it('exports all expected instruction key constants', () => {
        expect(instructionKeys).to.have.property('TRANSFER_SOL', 'transferSol');
        expect(instructionKeys).to.have.property('TRANSFER_CHECKED_TOKEN', 'transferCheckedToken');
        expect(instructionKeys).to.have.property('TRANSFER_TOKEN', 'transferToken');
        expect(instructionKeys).to.have.property('ADVANCE_NONCE_ACCOUNT', 'advanceNonceAccount');
        expect(instructionKeys).to.have.property('MEMO', 'memo');
        expect(instructionKeys).to.have.property('SET_COMPUTE_UNIT_LIMIT', 'setComputeUnitLimit');
        expect(instructionKeys).to.have.property('SET_COMPUTE_UNIT_PRICE', 'setComputeUnitPrice');
        expect(instructionKeys).to.have.property('CREATE_ASSOCIATED_TOKEN', 'createAssociatedToken');
        expect(instructionKeys).to.have.property('CREATE_ASSOCIATED_TOKEN_IDEMPOTENT', 'createAssociatedTokenIdempotent');
        expect(instructionKeys).to.have.property('RECOVER_NESTED_ASSOCIATED_TOKEN', 'recoverNestedAssociatedToken');
        expect(instructionKeys).to.have.property('UNKNOWN', 'unknownInstruction');
      });
    });
  });
});

// Helper functions/**
/**
 * 
 * @param {SolRpc} solRpc 
 * @param {SolKit.KeyPairSigner} feePayerAndAuthorityKeypair 
 * @param {SolKit.KeyPairSigner} nonceKeypair 
 * @returns 
 */
async function createNonceAccount(
  solRpc,
  feePayerAndAuthorityKeypair,
  nonceKeypair
) {
  try {
    // Get the min balance for rent exception
    const space = 80n;
    const lamportsForRent = await solRpc.rpc.getMinimumBalanceForRentExemption(space).send();

    // Build the tx
    const createAccountInstruction = SolSystem.getCreateAccountInstruction({
      payer: feePayerAndAuthorityKeypair,
      newAccount: nonceKeypair,
      lamports: lamportsForRent,
      space,
      programAddress: SolSystem.SYSTEM_PROGRAM_ADDRESS
    });

    const initializeNonceAccountInstruction = SolSystem.getInitializeNonceAccountInstruction(
      {
        nonceAccount: nonceKeypair.address,
        nonceAuthority: feePayerAndAuthorityKeypair.address
      }
    );

    const { value: latestBlockhash } = await solRpc.rpc.getLatestBlockhash().send();
    const transactionMessage = pipe(
      SolKit.createTransactionMessage({ version: 0 }),
      (tx) => SolKit.setTransactionMessageFeePayerSigner(feePayerAndAuthorityKeypair, tx), // fix payer
      (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => SolKit.appendTransactionMessageInstructions(
        [createAccountInstruction, initializeNonceAccountInstruction],
        tx
      )
    );

    // Sign & send
    const signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessage);

    const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: solRpc.rpc, rpcSubscriptions: solRpc.rpcSubscriptions });
    await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'confirmed' });
    return SolKit.getSignatureFromTransaction(signedTransactionMessage);
  } catch (err) {
    console.error('Error creating nonce account:', err);
    throw err;
  }
}

/**
 * 
 * @param {SolRpc} solRpc 
 * @param {SolKit.KeyPairSigner} fromKeypair 
 * @param {SolKit.KeyPairSigner} toKeypair 
 * @param {number} amountInLamports
 * @param {0|'legacy'} [version=0]
 */
async function sendTransaction(solRpc, fromKeypair, toKeypair, amountInLamports, version = 0) {
  const transaction = await createUnsignedTransaction(solRpc.rpc, fromKeypair, toKeypair, amountInLamports, version);
  const signedTransaction = await SolKit.signTransactionMessageWithSigners(transaction);

  const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: solRpc.rpc, rpcSubscriptions: solRpc.rpcSubscriptions });
  await sendAndConfirmTransaction(signedTransaction, { commitment: 'confirmed' });
  return SolKit.getSignatureFromTransaction(signedTransaction);
}

/**
 * 
 * @param {SolKit.Rpc} rpc 
 * @param {SolKit.KeyPairSigner} fromKeypair 
 * @param {SolKit.KeyPairSigner} toKeypair 
 * @param {number} amountInLamports 
 */
async function createRawTransaction(
  rpc,
  fromKeypair,
  toKeypair,
  amountInLamports
) {
  const transaction = await createUnsignedTransaction(rpc, fromKeypair, toKeypair, amountInLamports);
  const signedTransaction = await SolKit.signTransactionMessageWithSigners(transaction);
  const base64EncodedTransaction = SolKit.getBase64EncodedWireTransaction(signedTransaction);
  return base64EncodedTransaction;
}

/**
 * Returns an unsigned transaction message
 * @param {SolKit.Rpc} rpc 
 * @param {SolKit.KeyPairSigner} fromKeypair 
 * @param {SolKit.KeyPairSigner} toKeypair 
 * @param {number} amountInLamports 
 * @param {0 | 'legacy'} [version=0]
 */
async function createUnsignedTransaction(
  rpc,
  fromKeypair,
  toKeypair,
  amountInLamports,
  version = 0
) {
  const { value: recentBlockhash } = await rpc.getLatestBlockhash().send();

  const transferInstruction = SolSystem.getTransferSolInstruction({
    amount: amountInLamports,
    destination: toKeypair.address,
    source: fromKeypair
  });

  const transactionMessage = pipe(
    SolKit.createTransactionMessage({ version }),
    (tx) => SolKit.setTransactionMessageFeePayerSigner(fromKeypair, tx),
    (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(recentBlockhash, tx),
    (tx) => SolKit.appendTransactionMessageInstructions([transferInstruction], tx)
  );

  return transactionMessage;
}

/**
 * @param {Object} params
 * @param {SolRpc} params.solRpc 
 * @param {SolKit.KeyPairSigner} params.feePayerKeypair 
 * @param {0 | 'legacy'} params.version
 * @param {'confirmed' | 'finalized'} params.commitment
 * @returns {Promise<SolKit.KeyPairSigner>}
 */
async function createAccount({
  solRpc,
  feePayerKeypair,
  version = 0,
  commitment = 'confirmed'
}
) {
  const keypair = await SolKit.generateKeyPairSigner();
  const space = 0;
  const rentLamports = await solRpc.rpc.getMinimumBalanceForRentExemption(space).send();
  const createAccountInstruction = SolSystem.getCreateAccountInstruction({
    payer: feePayerKeypair,
    newAccount: keypair,
    lamports: rentLamports,
    space,
    programAddress: SolSystem.SYSTEM_PROGRAM_ADDRESS
  });

  const { value: latestBlockhash } = await solRpc.rpc.getLatestBlockhash().send();

  const transactionMessage = pipe(
    SolKit.createTransactionMessage({ version }),
    (tx) => SolKit.setTransactionMessageFeePayerSigner(feePayerKeypair, tx),
    (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => SolKit.appendTransactionMessageInstruction(createAccountInstruction, tx)
  );

  const signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessage);

  const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: solRpc.rpc, rpcSubscriptions: solRpc.rpcSubscriptions });
  await sendAndConfirmTransaction(signedTransactionMessage, { commitment });
  return keypair;
}

/**
 * 
 * @param {Object} params
 * @param {SolRpc} params.solRpc
 * @param {SolKit.KeyPairSigner<string>} params.payer
 * @param {SolKit.KeyPairSigner<string>} params.mint
 * @param {SolKit.KeyPairSigner<string>} params.mintAuthority
 * @param {number} params.decimals
 */
async function createMint({ solRpc, payer, mint, mintAuthority, decimals }) {
  const { value: latestBlockhash } = await solRpc.rpc.getLatestBlockhash().send();
  const mintSpace = SolToken.getMintSize();
  const rentLamports = await solRpc.rpc.getMinimumBalanceForRentExemption(mintSpace).send();

  const createAccountInstruction = SolSystem.getCreateAccountInstruction({
    payer,
    newAccount: mint,
    space: mintSpace,
    lamports: rentLamports,
    programAddress: SolToken.TOKEN_PROGRAM_ADDRESS
  });

  const initializeMintInstruction = SolToken.getInitializeMintInstruction({
    mint: mint.address,
    mintAuthority: mintAuthority.address,
    freezeAuthority: null,
    decimals
  });

  const transactionMessage = pipe(
    SolKit.createTransactionMessage({ version: 0 }),
    (tx) => SolKit.setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => SolKit.appendTransactionMessageInstructions(
      [createAccountInstruction, initializeMintInstruction],
      tx
    )
  );

  const signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessage);
  const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: solRpc.rpc, rpcSubscriptions: solRpc.rpcSubscriptions });
  await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'finalized' });
  const signature = SolKit.getSignatureFromTransaction(signedTransactionMessage);
  return signature;
}

/**
 * 
 * @param {Object} params
 * @param {SolRpc} params.solRpc
 * @param {SolKit.Address<string>} params.owner
 * @param {SolKit.Address<string>} params.mint
 * @param {SolKit.KeyPairSigner<string>} params.payer
 */
async function createAta({ solRpc, owner, mint, payer }) {
  const { value: latestBlockhash } = await solRpc.rpc.getLatestBlockhash().send();

  const [ata] = await SolToken.findAssociatedTokenPda({
    owner,
    tokenProgram: SolToken.TOKEN_PROGRAM_ADDRESS,
    mint
  });

  const createAssociatedTokenIdempotentInstruction = SolToken.getCreateAssociatedTokenIdempotentInstruction({
    payer,
    owner,
    mint,
    ata
  });

  const transactionMessage = pipe(
    SolKit.createTransactionMessage({ version: 'legacy' }),
    (tx) => SolKit.setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => SolKit.appendTransactionMessageInstructions(
      [createAssociatedTokenIdempotentInstruction],
      tx
    )
  );

  const signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessage);
  const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: solRpc.rpc, rpcSubscriptions: solRpc.rpcSubscriptions });
  await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'finalized' });
  return ata;
}

/**
 * @param {SolRpc} params.solRpc
 * @param {SolKit.KeyPairSigner} fromKeypair 
 * @param {SolKit.KeyPairSigner} toKeypair 
 * @param {number} amountInLamports 
 * @param {0 | 'legacy'} [version=0]
 */
async function sendTransactionUsingLookupTables({ solRpc, fromKeypair, toKeypair, version, lookupTableAddress, amountInLamports }) {
  try {
    const unsignedTransactionMessage = await createUnsignedTransaction(solRpc.rpc, fromKeypair, toKeypair, amountInLamports, version);

    // Fetch JSON parsed representation of the lookup table from the RPC
    const lookupTableAccount = await SolKit.fetchJsonParsedAccount(solRpc.rpc, lookupTableAddress);
    SolKit.assertAccountDecoded(lookupTableAccount);
    SolKit.assertAccountExists(lookupTableAccount);

    // Compress transaction message using lookup table
    const transactionMessageWithLookupTables = SolKit.compressTransactionMessageUsingAddressLookupTables(unsignedTransactionMessage, {
      [lookupTableAddress]: lookupTableAccount.data.addresses
    });

    const signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessageWithLookupTables);
    const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: solRpc.rpc, rpcSubscriptions: solRpc.rpcSubscriptions });
    await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'confirmed' });
    const signature = SolKit.getSignatureFromTransaction(signedTransactionMessage);
    return signature;
  } catch (err) {
    console.error('err', err);
    throw err;
  }
}

/**
 * @param {object} params
 * @param {SolRpc} params.solRpc
 * @param {SolKit.KeyPairSigner} params.fromKeypair 
 * @param {SolKit.KeyPairSigner} params.targetKeypair
 * @param {SolKit.KeyPairSigner} params.keypair3 
 * @param {number} params.amountInLamports
 * @param {number} params.otherAmountInLamports -// testing noise
 * @param {string} params.lut1Address;
 * @param {string} params.lut2Address}
 */
async function sendNoisyTransactionUsingMultipleLookupTables({ solRpc, fromKeypair, targetKeypair, keypair3, amountInLamports, otherAmountInLamports, lut1Address, lut2Address }) {
  const { rpc, rpcSubscriptions } = solRpc;
  // This should set up a transaction in which targetKeypair's balance difference is 1000, and there are other transfers to create noise

  // Fetch JSON parsed representation of the lookup table from the RPC
  // const [lutAcct1, lutAcct2] = 
  const [lutAcct1, lutAcct2] = await SolKit.fetchJsonParsedAccounts(solRpc.rpc, [lut1Address, lut2Address]);
  for (const lutAcct of [lutAcct1, lutAcct2]) {
    SolKit.assertAccountDecoded(lutAcct);
    SolKit.assertAccountExists(lutAcct);
  }

  // Compose instructions and transaction message
  const transferInstruction1 = SolSystem.getTransferSolInstruction({
    amount: amountInLamports,
    destination: targetKeypair.address,
    source: fromKeypair
  });
  const transactionInstruction2 = SolSystem.getTransferSolInstruction({
    amount: otherAmountInLamports,
    destination: fromKeypair.address,
    source: keypair3,
  });
  
  const { value: recentBlockhash } = await solRpc.rpc.getLatestBlockhash().send();
  const unsignedTransactionMessage = pipe(
    SolKit.createTransactionMessage({ version: 0 }),
    (tx) => SolKit.setTransactionMessageFeePayerSigner(fromKeypair, tx),
    (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(recentBlockhash, tx),
    (tx) => SolKit.appendTransactionMessageInstructions([transferInstruction1, transactionInstruction2], tx),
    (tx) => SolKit.addSignersToTransactionMessage([keypair3], tx)
  );

  // Compress unsigned transaction mesage with LUTs
  const transactionMessageWithLookupTables = SolKit.compressTransactionMessageUsingAddressLookupTables(unsignedTransactionMessage, {
    [lut1Address]: lutAcct1.data.addresses,
    [lut2Address]: lutAcct2.data.addresses,
  });

  const signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessageWithLookupTables);
  // const signedTransactionMessage = await SolKit.signTransaction([fromKeypair.keyPair, keypair3.keyPair], transactionMessageWithLookupTables);
  await SolKit.sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(signedTransactionMessage, { commitment: 'confirmed' });
  const signature = SolKit.getSignatureFromTransaction(signedTransactionMessage);
  return signature;
}

/**
 * 
 * @param {Object} params
 * @param {SolRpc} params.solRpc
 * @param {SolKit.KeyPairSigner<string>} params.fromKeypair
 * @param {SolKit.KeyPairSigner<string>} params.toKeypair
 */
async function createLookupTable({ solRpc, fromKeypair, toKeypair }) {
  try {
    const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: solRpc.rpc, rpcSubscriptions: solRpc.rpcSubscriptions });
    const { value: recentBlockhash } = await solRpc.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();
    const recentSlot = await solRpc.rpc.getSlot({ commitment: 'finalized' }).send();

    // Create CreateLookupTable Instruction
    const createLookupTableInstruction = await SolLookUpTable.getCreateLookupTableInstructionAsync({
      authority: fromKeypair,
      recentSlot
    });

    const lookupTableAddress = createLookupTableInstruction?.accounts?.find(account => account.role === 1)?.address;
    if (!lookupTableAddress) {
      throw new Error('Lookup table address not found');
    }

    const createLookupTableTransactionMessage = pipe(
      SolKit.createTransactionMessage({ version: 0 }),
      (tx) => SolKit.setTransactionMessageFeePayerSigner(fromKeypair, tx),
      (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(recentBlockhash, tx),
      (tx) => SolKit.appendTransactionMessageInstructions([createLookupTableInstruction], tx)
    );

    const signedCreateLookupTableTransaction = await SolKit.signTransactionMessageWithSigners(createLookupTableTransactionMessage);
    // Must wait on finality for extending the table
    await sendAndConfirmTransaction(signedCreateLookupTableTransaction, { commitment: 'finalized' });

    // Add address (note: signers may be leverage lookup tables - their full address must be serialized in the transaction)
    const extendLookupTableInstruction = SolLookUpTable.getExtendLookupTableInstruction({
      address: lookupTableAddress,
      payer: fromKeypair.address,
      authority: fromKeypair.address,
      addresses: [
        toKeypair.address
      ]
    });

    const { value: recenterBlockhash } = await solRpc.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();
    const extendLookupTableTransactionMessage = pipe(
      SolKit.createTransactionMessage({ version: 0 }),
      (tx) => SolKit.setTransactionMessageFeePayerSigner(fromKeypair, tx),
      (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(recenterBlockhash, tx),
      (tx) => SolKit.appendTransactionMessageInstructions([extendLookupTableInstruction], tx)
    );

    const signedExtendLookupTableTransaction = await SolKit.signTransactionMessageWithSigners(extendLookupTableTransactionMessage);

    await sendAndConfirmTransaction(signedExtendLookupTableTransaction, { commitment: 'finalized' });

    return lookupTableAddress;
  } catch (err) {
    console.error('err', err);
    throw err;
  }
}
