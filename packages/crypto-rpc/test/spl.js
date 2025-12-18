import sinon from 'sinon';
import { expect } from 'chai';
import { createRequire } from 'module';
import * as SolKit from '@solana/kit';
import * as SolSystem from '@solana-program/system';
import * as SolToken from '@solana-program/token';
import { pipe } from '@solana/functional';
import { SolRpc } from '../lib/sol/SolRpc.js';
import { SplRpc } from '../lib/sol/SplRpc.js';
import { SOL_ERROR_MESSAGES } from '../lib/sol/error_messages.js';

const require = createRequire(import.meta.url);
const privateKey1 = require('../blockchain/solana/test/keypair/id.json');
const privateKey2 = require('../blockchain/solana/test/keypair/id2.json');
// const SolKit = require('@solana/kit'); // Using require to avoid issues with sinon stubbing/spying ES module imports

const bs58Encoder = SolKit.getBase58Encoder();
const tokenProgramAddress = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

describe('SPL Tests', () => {
  const topLevelConfig = {
    decimals: 6, // As for USDC/USDT
  };

  const assertBalanceDetails = ({ transaction, txInput }) => {
    expect(transaction).to.be.an('object').that.is.not.null;
    expect(transaction).to.have.property('accountKeys').that.is.an('array');
    expect(transaction.accountKeys.every(acct => typeof acct === 'string')).to.be.true;
    expect(transaction.accountKeys).to.include(txInput.destinationAta);
    const destinationAtaIndex = transaction.accountKeys.findIndex(acct => acct == txInput.destinationAta);

    expect(transaction).to.have.property('meta').that.is.an('object').that.is.not.null;
    expect(transaction.meta).to.have.property('preTokenBalances').that.is.an('array').that.is.not.empty;
    expect(transaction.meta).to.have.property('postTokenBalances').that.is.an('array').that.is.not.empty;
    expect(transaction.meta.preTokenBalances.some(bal => bal.accountIndex === destinationAtaIndex)).to.be.true;
    expect(transaction.meta.postTokenBalances.some(bal => bal.accountIndex === destinationAtaIndex)).to.be.true;
    const destinationPreTokenBalance = transaction.meta.preTokenBalances.find(bal => bal.accountIndex === destinationAtaIndex);
    const destinationPostTokenBalance = transaction.meta.postTokenBalances.find(bal => bal.accountIndex === destinationAtaIndex);
    
    expect(destinationPreTokenBalance).to.be.an('object').that.is.not.null;
    expect(destinationPreTokenBalance).to.have.property('uiTokenAmount').that.is.an('object').that.is.not.null;
    expect(destinationPreTokenBalance.uiTokenAmount).to.have.property('uiAmount');
    let destinationPreTokenBalanceAmt;
    if (destinationPreTokenBalance.uiTokenAmount.amount === '0') {
      expect(destinationPreTokenBalance.uiTokenAmount.uiAmount).to.be.null;
      destinationPreTokenBalanceAmt = 0;
    } else {
      expect(destinationPreTokenBalance.uiTokenAmount.uiAmount).to.be.a('number');
      destinationPreTokenBalanceAmt = destinationPreTokenBalance.uiTokenAmount.uiAmount;
    }
    expect(destinationPreTokenBalance.uiTokenAmount).to.have.property('decimals').that.is.a('number').equal(topLevelConfig.decimals);

    expect(destinationPostTokenBalance).to.be.an('object').that.is.not.null;
    expect(destinationPostTokenBalance).to.have.property('uiTokenAmount').that.is.an('object').that.is.not.null;
    expect(destinationPostTokenBalance.uiTokenAmount).to.have.property('uiAmount');
    if (destinationPostTokenBalance.uiTokenAmount.amount === '0') {
      expect(destinationPostTokenBalance.uiTokenAmount.uiAmount).to.be.null;
    } else {
      expect(destinationPostTokenBalance.uiTokenAmount.uiAmount).to.be.a('number').greaterThanOrEqual(0);
    }
    expect(destinationPostTokenBalance.uiTokenAmount).to.have.property('decimals').that.is.a('number').equal(destinationPreTokenBalance.uiTokenAmount.decimals); // Explicit equality test on tx meta itself - not expected value

    // In BASE units, not atomic units
    const difference = (destinationPostTokenBalance.uiTokenAmount.uiAmount * 10 ** destinationPostTokenBalance.uiTokenAmount.decimals) - (destinationPreTokenBalanceAmt * 10 ** destinationPreTokenBalance.uiTokenAmount.decimals); // Pre token balancce was 0, but it's reported as null
    expect(difference).to.equal(txInput.amount);
    // Usable for other specific assertions
    return difference;
  };

  describe('Inheritance tests', () => {
    let splRpc;
    /** @type {SolKit.KeyPairSigner<string>} */
    let senderKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let receiverKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let nonceKeypair;
    
    before(async () => {
      // Setup test keypairs
      senderKeypair = await SolKit.generateKeyPairSigner();
      receiverKeypair = await SolKit.generateKeyPairSigner();
      nonceKeypair = await SolKit.generateKeyPairSigner();
    });

    beforeEach(() => {
      sinon.stub(SolRpc.prototype, 'getBalance').resolves(100);
      sinon.stub(SolRpc.prototype, 'createNonceAccount').resolves('mockSignature');
      sinon.stub(SolRpc.prototype, 'estimateFee').resolves(100);
      sinon.stub(SolRpc.prototype, 'estimateTransactionFee').resolves(100);
      sinon.stub(SolRpc.prototype, 'addPriorityFee').resolves({});
      sinon.stub(SolRpc.prototype, 'getBestBlockHash');
      sinon.stub(SolRpc.prototype, 'getTransaction').resolves({});
      sinon.stub(SolRpc.prototype, 'getTransactions').resolves([]);
      sinon.stub(SolRpc.prototype, 'getTransactionCount').resolves(10);
      sinon.stub(SolRpc.prototype, 'getRawTransaction').resolves('mockRawTx');
      sinon.stub(SolRpc.prototype, 'decodeRawTransaction').resolves({});
      sinon.stub(SolRpc.prototype, 'sendRawTransaction').resolves('mockSignature');
      sinon.stub(SolRpc.prototype, 'getBlock').resolves({});
      sinon.stub(SolRpc.prototype, 'getLatestFinalizedBlock').resolves({});
      sinon.stub(SolRpc.prototype, 'getLatestSignature').resolves({});
      sinon.stub(SolRpc.prototype, 'getConfirmations').resolves({});
      sinon.stub(SolRpc.prototype, 'getTip').resolves({});
      sinon.stub(SolRpc.prototype, 'getServerInfo').resolves({});
    
      // Create test instance after stubbing parent methods
      splRpc = new SplRpc({
        chain: 'SOL',
        host: process.env.HOST_SOL || 'solana',
        protocol: 'http',
        port: 8899,
        wsPort: 8900
      });
    });

    afterEach(() => {
      sinon.restore();
    });

    it('inherits createNonceAccount method from SolRpc', async () => {
      await splRpc.createNonceAccount(senderKeypair, nonceKeypair);
      expect(SolRpc.prototype.createNonceAccount.callCount).to.equal(1);
    });
    it('inherits estimateFee method from SolRpc', async () => {
      await splRpc.estimateFee({ rawTx: 'mockRawTx' });
      expect(SolRpc.prototype.estimateFee.callCount).to.equal(1);
    });
    it('inherits estimateTransactionFee method from SolRpc', async () => {
      await splRpc.estimateTransactionFee({ rawTx: 'mockRawTx' });
      expect(SolRpc.prototype.estimateTransactionFee.callCount).to.equal(1);
    });
    it('inherits addPriorityFee method from SolRpc', async () => {
      const transactionMessage = await createUnsignedTransaction(splRpc.rpc, senderKeypair, receiverKeypair, 10);
      await splRpc.addPriorityFee({ transactionMessage });
      expect(SolRpc.prototype.addPriorityFee.callCount).to.equal(1);
    });
    it('inherits getBestBlockHash method from SolRpc', async () => {
      await splRpc.getBestBlockHash();
      expect(SolRpc.prototype.getBestBlockHash.callCount).to.equal(1);
    });
    it('inherits getTransaction method from SolRpc', async () => {
      await splRpc.getTransaction('mockSignature');
      expect(SolRpc.prototype.getTransaction.callCount).to.equal(1);
    });
    it('inherits getTransactions method from SolRpc', async () => {
      await splRpc.getTransactions({ address: 'mockAddress' });
      expect(SolRpc.prototype.getTransactions.callCount).to.equal(1);
    });
    it('inherits getTransactionCount method from SolRpc', async () => {
      await splRpc.getTransactionCount();
      expect(SolRpc.prototype.getTransactionCount.callCount).to.equal(1);
    });
    it('inherits getRawTransaction method from SolRpc', async () => {
      await splRpc.getRawTransaction({ txid: 'mockTxId' });
      expect(SolRpc.prototype.getRawTransaction.callCount).to.equal(1);
    });
    it('inherits decodeRawTransaction method from SolRpc', async () => {
      await splRpc.decodeRawTransaction({ rawTx: 'mockRawTx' });
      expect(SolRpc.prototype.decodeRawTransaction.callCount).to.equal(1);
    });
    it('inherits sendRawTransaction method from SolRpc', async () => {
      await splRpc.sendRawTransaction({ rawTx: 'mockRawTx' });
      expect(SolRpc.prototype.sendRawTransaction.callCount).to.equal(1);
    });
    it('inherits getBlock method from SolRpc', async () => {
      await splRpc.getBlock({ height: 1 });
      expect(SolRpc.prototype.getBlock.callCount).to.equal(1);
    });
    it('inherits getLatestSignature method from SolRpc', async () => {
      await splRpc.getLatestSignature();
      expect(SolRpc.prototype.getLatestSignature.callCount).to.equal(1);
    });
    it('inherits getConfirmations method from SolRpc', async () => {
      await splRpc.getConfirmations({ txid: 'mockTxId' });
      expect(SolRpc.prototype.getConfirmations.callCount).to.equal(1);
    });
    it('inherits getTip method from SolRpc', async () => {
      await splRpc.getTip();
      expect(SolRpc.prototype.getTip.callCount).to.equal(1);
    });
    it('inherits getServerInfo method from SolRpc', async () => {
      await splRpc.getServerInfo();
      expect(SolRpc.prototype.getServerInfo.callCount).to.equal(1);
    });
  });
  describe('Local tests', function () {
    this.timeout(10e5);
    const config = {
      chain: 'SOL',
      host: process.env.HOST_SOL || 'solana',
      protocol: 'http',
      port: 8899,
      wsPort: 8900
    };
    
    /** @type {SplRpc} */
    let splRpc;
    /** @type {SolKit.KeyPairSigner<string>} */
    let senderKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let receiverKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let nonceAccountKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let mintKeypair;
    /** @type {SolKit.Address<string>} */
    let senderAta;
    
    before(async function () {
      // For these tests, the nonce authority will be the sender
      senderKeypair = await SolKit.createKeyPairSignerFromBytes(Uint8Array.from(privateKey1));
      receiverKeypair = await SolKit.createKeyPairSignerFromBytes(Uint8Array.from(privateKey2));

      splRpc = new SplRpc(config);

      // Airdrop if no money on sender
      const { value: senderBalance } = await splRpc.rpc.getBalance(senderKeypair.address).send();
      if (Number(senderBalance) < 1e10) {
        const airdropSignature = await splRpc.rpc.requestAirdrop(senderKeypair.address, 1e10).send();
        const { value: statuses } = await splRpc.rpc.getSignatureStatuses([airdropSignature]).send();
        let status = statuses[0];
        let remainingTries = 100;
        while (remainingTries > 0 && status?.confirmationStatus !== 'finalized') {
          await new Promise(resolve => setTimeout(resolve, 250));
          const { value: statuses } = await splRpc.rpc.getSignatureStatuses([airdropSignature]).send();
          status = statuses[0];
          remainingTries--;
        }

        if (status.confirmationStatus !== 'finalized') {
          throw new Error('Sender balance top-off was not finalized in the specified time interval');
        }
      }

      // Create nonce account
      nonceAccountKeypair = await SolKit.generateKeyPairSigner();
      await createNonceAccount(splRpc, senderKeypair, nonceAccountKeypair);

      // Create mint
      mintKeypair = await SolKit.generateKeyPairSigner();
      await createMint({ splRpc, payer: senderKeypair, mint: mintKeypair, mintAuthority: senderKeypair, decimals: topLevelConfig.decimals });
      senderAta = await createAta({ splRpc, owner: senderKeypair.address, mint: mintKeypair.address, payer: senderKeypair });
      await mintTokens({ splRpc, payer: senderKeypair, mint: mintKeypair.address, mintAuthority: senderKeypair, targetAta: senderAta, decimals: topLevelConfig.decimals });
    });

    describe('getBalance', function () {
      it('returns an object representing the token balance', async () => {
        const value = await splRpc.getBalance({ address: senderAta });
        expect(value).to.be.an('object');
        expect(value).to.have.property('amount').that.is.a('string');
        expect(value).to.have.property('decimals').that.is.a('number');
        if (value.uiAmount) {
          expect(value.uiAmount).to.be.a('number');
        } else {
          expect(value.uiAmount).to.be.null;
        }
        expect(value).to.have.property('uiAmountString').that.is.a('string');
      });

      it('throws error if provided address does not belong to an onchain ATA account', async () => {
        const badKeypair = await SolKit.generateKeyPairSigner();
        try {
          await splRpc.getBalance({ address: badKeypair.address });
        } catch (err) {
          expect(err.message).to.equal(SOL_ERROR_MESSAGES.TOKEN_ACCOUNT_NOT_FOUND);
        }
      });

      it('throws error if provided address represents a valid ata address for an uninitialized ata account', async () => {
        // This happens when @solana-program/token 'findAssociatedTokenPda is used to derive an ata address, but the address has not been created
        try {
          const solAddress = receiverKeypair.address;
          const derivedAta = await splRpc.deriveAta({ solAddress, mintAddress: mintKeypair.address });
          await splRpc.getBalance({ address: derivedAta });
        } catch (err) {
          expect(err.message).to.equal(SOL_ERROR_MESSAGES.TOKEN_ACCOUNT_NOT_FOUND);
        }
      });

      it('throws error if provided address is a SOL address', async () => {
        try {
          await splRpc.getBalance({ address: senderKeypair.address });
        } catch (err) {
          expect(err.message).to.equal(SOL_ERROR_MESSAGES.PROVIDED_TOKEN_ADDRESS_IS_SOL);
        }
      });
    });

    describe('getOrCreateAta', function () {
      // createAccount requires finalization - it's time-intensive
      this.timeout(20000);
      /** @type {SolKit.KeyPairSigner<string>} */
      let ownerKeypair;
      let sendAndConfirmFactorySpy;
      let resolvedCreateAccountArray;
      let resolvedCreateAccountIndex = 0;

      before(async function () {
        // createAccount waits for transaction finalization. This takes a lot of time. Processing in parallel mitigates this issue to a large extend.
        // Update GET_OR_CREATE_ATA_TESTS_COUNT when adding/removing tests to the "getOrCreateAta" describe block.
        const GET_OR_CREATE_ATA_TESTS_COUNT = 3;
        resolvedCreateAccountArray = await Promise.all(
          Array(GET_OR_CREATE_ATA_TESTS_COUNT).fill(0)
            .map(async () => createAccount({ splRpc, feePayerKeypair: senderKeypair, version: 'legacy' }))
        );
      });

      beforeEach(async function () {
        ownerKeypair = resolvedCreateAccountArray[resolvedCreateAccountIndex];
        resolvedCreateAccountIndex++;
        sendAndConfirmFactorySpy = sinon.spy(SolRpc.prototype, '_sendAndConfirmTransactionFactory');
      });

      afterEach(function () {
        sinon.restore();
      });

      it('can create an ata', async () => {
        const result = await splRpc.getOrCreateAta({ owner: ownerKeypair.address, mint: mintKeypair.address, feePayer: senderKeypair });
        expect(result).to.be.a('string');
        // Verify that the creation transaction was sent
        expect(sendAndConfirmFactorySpy.callCount).to.equal(1);
      });

      it('can retrieve an existing ata', async () => {
        const ata = await createAta({ splRpc, owner: ownerKeypair.address, mint: mintKeypair.address, payer: senderKeypair });
        sendAndConfirmFactorySpy.resetHistory();

        const result = await splRpc.getOrCreateAta({ owner: ownerKeypair.address, mint: mintKeypair.address, feePayer: senderKeypair });
        expect(result).to.be.a('string');
        expect(result).to.equal(ata);
        // Ensure no transaction is sent (saving the sender the transaction fee)
        expect(sendAndConfirmFactorySpy.callCount).to.equal(0);
      });

      it('throws "SolanaError: Invalid parameter (mint)" error if invalid mint', async () => {
        const invalidMint = receiverKeypair.address;
        try {
          await splRpc.getOrCreateAta({
            owner: ownerKeypair.address,
            mint: invalidMint,
            feePayer: senderKeypair
          });
          throw new Error('Should have thrown');
        } catch (err) {
          expect(err.message).to.equal('SolanaError: Invalid parameter (mint)');
        }
      });
    });
    
    describe('sendToAddress and getTransaction', () => {
      // this.timeout(10e5);
      let inputBase;
      /** @type {Array<SolKit.KeyPairSigner<string>>} */
      let receiverKeypairs;
      /** @type {SolKit.KeyPairSigner<string>} */
      let receiverKeypair;
      let receiverKeypairsIndex = 0;
      /** @type {SolKit.KeyPairSigner<string>} */
      let fastDescribeBlockReceiverKeypair;

      before(async function () {
        // createAccount waits for tx finalization, thus is time-intensive
        this.timeout(10e5);
        const SEND_TO_ADDRESS_INDIVIDUAL_TEST_COUNT = 2;
        const REQUIRED_CREATED_ACCOUNT_COUNT = SEND_TO_ADDRESS_INDIVIDUAL_TEST_COUNT + 1; // for the fast tests describe block
        receiverKeypairs = await Promise.all(
          Array(REQUIRED_CREATED_ACCOUNT_COUNT).fill(0)
            .map(async () => createAccount({ splRpc, feePayerKeypair: senderKeypair, version: 'legacy' }))
        );

        fastDescribeBlockReceiverKeypair = receiverKeypairs[receiverKeypairsIndex];
        receiverKeypairsIndex++;

        inputBase = {
          amount: 10,
          fromAccountKeypair: senderKeypair,
          mintAddress: mintKeypair.address,
          decimals: topLevelConfig.decimals
        };
      });

      beforeEach(function () {
        receiverKeypair = receiverKeypairs[receiverKeypairsIndex];
        receiverKeypairsIndex++;
        sinon.spy(splRpc, 'getOrCreateAta');
      });

      afterEach(function () {
        sinon.restore();
      });

      it('can create ata and send a versioned transaction', async function () {
        const result = await splRpc.sendToAddress({
          ...inputBase,
          address: receiverKeypair.address,
          txType: 0,
          priority: false
        });
        expect(result).to.be.an('object');
        expect(result).to.have.property('txid').that.is.a('string');
        expect(result).to.have.property('destinationAta').that.is.a('string');
        expect(result).to.have.property('sourceAta').that.equals(senderAta);
        expect(splRpc.getOrCreateAta.callCount).to.equal(2); // b/c destinationAta not included AND sourceAta not included
      });

      it('can create ata and send a legacy transaction', async function () {
        const result = await splRpc.sendToAddress({
          ...inputBase,
          address: receiverKeypair.address,
          txType: 'legacy',
          priority: false
        });
        expect(result).to.be.an('object');
        expect(result).to.have.property('txid').that.is.a('string');
        expect(result).to.have.property('destinationAta').that.is.a('string');
        expect(result).to.have.property('sourceAta').that.equals(senderAta);
        expect(splRpc.getOrCreateAta.callCount).to.equal(2); // b/c destinationAta not included AND sourceAta not included
      });

      describe('faster tests using source and destination atas - includes getTransaction checks', function () {
        let inputBaseWithAtas;
        let destinationAta;
        before(async function () {
          destinationAta = await createAta({
            splRpc,
            owner: fastDescribeBlockReceiverKeypair.address,
            mint: mintKeypair.address,
            payer: senderKeypair
          });
          inputBaseWithAtas = {
            ...inputBase,
            destinationAta,
            sourceAta: senderAta,
            address: fastDescribeBlockReceiverKeypair.address,
            txType: 'legacy',
            priority: false
          };
        });

        it('can send a transaction without calling splRPC.getOrCreateAta if ata params are included', async function () {
          // sendToAddress tests
          const result = await splRpc.sendToAddress({
            ...inputBaseWithAtas
          });
          expect(result).to.be.an('object');
          expect(result).to.have.property('txid').that.is.a('string');
          expect(result).to.have.property('destinationAta').that.equals(destinationAta);
          expect(result).to.have.property('sourceAta').that.equals(senderAta);
          expect(splRpc.getOrCreateAta.callCount).to.equal(0); // b/c destinationAtaAND sourceAta are included

          // getTransaction tests
          const transaction = await splRpc.getTransaction({ txid: result.txid });
          assertBalanceDetails({ transaction, txInput: inputBaseWithAtas });
        });
  
        it('can send a durable nonce transaction', async function () {
          const result = await splRpc.sendToAddress({
            ...inputBaseWithAtas,
            nonceAddress: nonceAccountKeypair.address
          });
          expect(result).to.be.an('object');
          expect(result).to.have.property('txid').that.is.a('string');
          expect(result).to.have.property('destinationAta').that.equals(destinationAta);
          expect(result).to.have.property('sourceAta').that.equals(senderAta);

          const transaction = await splRpc.getTransaction({ txid: result.txid });
          assertBalanceDetails({ transaction, txInput: inputBaseWithAtas });
        });
  
        it('can send a prioritized transaction', async function () {
          const result = await splRpc.sendToAddress({
            ...inputBaseWithAtas,
            priority: true,
          });
          expect(result).to.be.an('object');
          expect(result).to.have.property('txid').that.is.a('string');
          expect(result).to.have.property('destinationAta').that.equals(destinationAta);
          expect(result).to.have.property('sourceAta').that.equals(senderAta);
        });
      });
    });
  });
  describe('Devnet tests', function () {
    this.timeout(1.5e4);
    const config = {
      chain: 'SOL',
      host: 'api.devnet.solana.com',
      protocol: 'https'
      // Do not include ports
    };
    
    this.timeout(15e4);
    /** @type {SplRpc} */
    let splRpc;
    /** @type {SolKit.KeyPairSigner<string>} */
    let senderKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let receiverKeypair;
    /** @type {SolKit.Address<string>} */
    let senderAta;
    /** @type {SolKit.Address<string>} */
    let receiverAta;
    let txInputBase;

    before(async function () {
      senderKeypair = await SolKit.createKeyPairSignerFromPrivateKeyBytes(bs58Encoder.encode('H6x8RRKJ9xBx71N8wn8USBghwApSqHP7A9LT5Mxo6rP9'));
      receiverKeypair = await SolKit.createKeyPairSignerFromPrivateKeyBytes(bs58Encoder.encode('CVFoRgAv6LNQvX6EmPeqGjgUDZYvjHgqbXve4rus4o63'));
      splRpc = new SplRpc(config);

      // Ensure sender and receiver are properly funded - this is important because although the value is held constant, transaction fees are taken out
      const { value: senderBalance } = await splRpc.rpc.getBalance(senderKeypair.address).send();
      const { value: receiverBalance } = await splRpc.rpc.getBalance(receiverKeypair.address).send();
      const THRESHOLD_LAMPORTS = 100000;
      if (!(Number(senderBalance) >= THRESHOLD_LAMPORTS && Number(receiverBalance) >= THRESHOLD_LAMPORTS)) {
        console.warn('Devnet accounts need more funds');
      }

      senderAta = SolKit.address('BBBGCUHgh5i75rw4vhdYSe3mHHvMUbUukCEcqUYLuNJP');
      receiverAta = SolKit.address('2Ba5zAJRBnd4E96Ms8HQGcrn5m8qaYgPdym14RzN2ohy');
      txInputBase = {
        amount: 100,
        mintAddress: SolKit.address('33mppJgqTnSkumFDPUTbTUquejR7Lxyzevh5LxQpqvPF'),
        decimals: 6,
        priority: false
      };
    });

    beforeEach(function () {
      sinon.spy(splRpc, 'getOrCreateAta');
    });

    afterEach(function () {
      sinon.restore();
    });

    // The versioned transaction and legacy transaction tests below should send the same amount back and forth
    it('can send a versioned transaction', async function () {
      const sourceAta = senderAta;
      const destinationAta = receiverAta;
      const result = await splRpc.sendToAddress({
        ...txInputBase,
        address: receiverKeypair.address,
        fromAccountKeypair: senderKeypair,
        txType: 0,
        destinationAta,
        sourceAta
      });
      expect(result).to.be.an('object');
      expect(result).to.have.property('txid').that.is.a('string');
      expect(result).to.have.property('destinationAta').that.equals(destinationAta);
      expect(result).to.have.property('sourceAta').that.equals(sourceAta);
      expect(splRpc.getOrCreateAta.callCount).to.equal(0); // b/c destinationAta not included AND sourceAta not included
    });

    it('can send a legacy transaction', async function () {
      const sourceAta = receiverAta;
      const destinationAta = senderAta;
      const result = await splRpc.sendToAddress({
        ...txInputBase,
        address: senderKeypair.address,
        fromAccountKeypair: receiverKeypair,
        txType: 'legacy',
        destinationAta,
        sourceAta
      });
      expect(result).to.be.an('object');
      expect(result).to.have.property('txid').that.is.a('string');
      expect(result).to.have.property('destinationAta').that.equals(destinationAta);
      expect(result).to.have.property('sourceAta').that.equals(sourceAta);
      expect(splRpc.getOrCreateAta.callCount).to.equal(0); // b/c destinationAta not included AND sourceAta not included
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
    await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'finalized' });
    return SolKit.getSignatureFromTransaction(signedTransactionMessage);
  } catch (err) {
    console.error('Error creating nonce account:', err);
    throw err;
  }
}

/**
 * 
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
 * @param {SplRpc} params.splRpc 
 * @param {SolKit.KeyPairSigner} params.feePayerKeypair 
 * @param {0 | 'legacy'} params.version - default 0
 * @returns {Promise<SolKit.KeyPairSigner>}
 */
async function createAccount({
  splRpc,
  feePayerKeypair,
  version = 0
}) {
  const keypair = await SolKit.generateKeyPairSigner();
  const space = 0;
  const rentLamports = await splRpc.rpc.getMinimumBalanceForRentExemption(space).send();
  const createAccountInstruction = SolSystem.getCreateAccountInstruction({
    payer: feePayerKeypair,
    newAccount: keypair,
    lamports: rentLamports,
    space,
    programAddress: SolSystem.SYSTEM_PROGRAM_ADDRESS
  });

  const { value: latestBlockhash } = await splRpc.rpc.getLatestBlockhash().send();

  const transactionMessage = pipe(
    SolKit.createTransactionMessage({ version }),
    (tx) => SolKit.setTransactionMessageFeePayerSigner(feePayerKeypair, tx),
    (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => SolKit.appendTransactionMessageInstruction(createAccountInstruction, tx)
  );

  const signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessage);

  const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: splRpc.rpc, rpcSubscriptions: splRpc.rpcSubscriptions });
  await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'finalized' });
  return keypair;
}

/**
 * 
 * @param {Object} params
 * @param {SplRpc} params.splRpc
 * @param {SolKit.Address<string>} params.owner
 * @param {SolKit.Address<string>} params.mint
 * @param {SolKit.KeyPairSigner<string>} params.payer
 */
async function createAta({ splRpc, owner, mint, payer }) {
  const { value: latestBlockhash } = await splRpc.rpc.getLatestBlockhash().send();
  
  const [ata] = await SolToken.findAssociatedTokenPda({
    owner,
    tokenProgram: tokenProgramAddress,
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
  const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: splRpc.rpc, rpcSubscriptions: splRpc.rpcSubscriptions });
  await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'finalized' });
  return ata;
}

/**
 * 
 * @param {Object} params
 * @param {SplRpc} params.splRpc
 * @param {SolKit.KeyPairSigner<string>} params.payer
 * @param {SolKit.KeyPairSigner<string>} params.mint
 * @param {SolKit.KeyPairSigner<string>} params.mintAuthority
 * @param {number} params.decimals
 */
async function createMint({ splRpc, payer, mint, mintAuthority, decimals }) {
  const { value: latestBlockhash } = await splRpc.rpc.getLatestBlockhash().send();
  const mintSpace = SolToken.getMintSize();
  const rentLamports = await splRpc.rpc.getMinimumBalanceForRentExemption(mintSpace).send();

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
  const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: splRpc.rpc, rpcSubscriptions: splRpc.rpcSubscriptions });
  await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'finalized' });
  const signature = SolKit.getSignatureFromTransaction(signedTransactionMessage);
  return signature;
}

/**
 * 
 * @param {Object} params
 * @param {SplRpc} params.splRpc
 * @param {SolKit.KeyPairSigner<string>} params.payer
 * @param {SolKit.Address<string>} params.mint
 * @param {SolKit.KeyPairSigner<string>} params.mintAuthority
 * @param {SolKit.Address<string>} params.targetAta
 * @param {number} params.decimals
 */
async function mintTokens({ splRpc, payer, mint, mintAuthority, targetAta, decimals }) {
  const { value: latestBlockhash } = await splRpc.rpc.getLatestBlockhash().send();

  const mintToCheckedInstruction = SolToken.getMintToCheckedInstruction({
    mint,
    mintAuthority: mintAuthority.address,
    amount: 1000 * 10 ** decimals,
    decimals,
    token: targetAta
  });

  const transactionMessage = pipe(
    SolKit.createTransactionMessage({ version: 0 }),
    (tx) => SolKit.setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => SolKit.appendTransactionMessageInstructions(
      [mintToCheckedInstruction],
      tx
    )
  );

  const signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessage);
  const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: splRpc.rpc, rpcSubscriptions: splRpc.rpcSubscriptions });
  await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'finalized' });
  const signature = SolKit.getSignatureFromTransaction(signedTransactionMessage);
  return signature;
}
