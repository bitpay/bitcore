import EventEmitter from 'events';
import { SolKit, SolanaProgram } from '@bitpay-labs/crypto-wallet-core';
import { pipe } from '@solana/functional';
import bs58 from 'bs58';
import { SOL_ERROR_MESSAGES } from './error_messages.js';
import { parseInstructions } from './transaction-parser.js';

const {
  ComputeBudget: SolComputeBudget,
  System: SolSystem,
  Token: SolToken
} = SolanaProgram;

export class SolRpc {
  /**
   * Constructs a new instance of the SolRPC class.
   * 
   * @param {Object} config - The configuration object containing the connection details.
   * @param {string} config.protocol - The network protocol (e.g., 'http', 'https', 'wss'). - remove on review agreement
   * @param {string} config.host - The host URL or IP address.
   * @param {number} [config.port] - The port number
   * @param {number} [config.wsPort] - The WS port number
   */
  constructor(config) {
    this.config = config;
    let { rpcPort } = this.config;
    const { protocol, host, port, wsPort: rpcSubscriptionsPort } = this.config;
    rpcPort = rpcPort || port;
    this.rpcUrl = `${protocol}://${host}${rpcPort ? `:${rpcPort}` : ''}`;
    this.rpcSubscriptionUrl = `${['https', 'wss'].includes(protocol) ? 'wss' : 'ws'}://${host}${rpcSubscriptionsPort ? `:${rpcSubscriptionsPort}` : ''}`;
    this.rpc = this.initRpcConnection();
    this.rpcSubscriptions = this.initRpcSubscriptions();
    this.emitter = new EventEmitter();
    // configuration for retrieving versioned blocks and transactions
    this._versionedConfig = {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    };
  }

  initRpcConnection() {
    return SolKit.createSolanaRpc(this.rpcUrl);
  }

  initRpcSubscriptions() {
    return SolKit.createSolanaRpcSubscriptions(this.rpcSubscriptionUrl);
  }

  async cleanup() {
    // Close WebSocket connections and remove subscriptions
    if (this.rpcSubscriptions) {
      // Remove all subscription listeners first
      const subscriptionEvents = this.rpcSubscriptions.eventNames();
      if (typeof subscriptionEvents === 'object') {
        for (const event of Object.keys(subscriptionEvents)) {
          // Get listeners and ensure it's an array
          const listeners = Array.from(this.rpcSubscriptions.listeners(event) || []);
          for (const listener of listeners) {
            this.rpcSubscriptions.removeListener(event, listener);
          }
        }
      }

      // Then disconnect the WebSocket
      await this.rpcSubscriptions.disconnect();
    }

    // Remove all listeners from the emitter
    if (this.emitter) {
      this.emitter.removeAllListeners();
    }

    // Clear any references
    this.rpcSubscriptions = null;
  }

  getConnection() {
    return this.rpc;
  }

  /**
   * Retrieves the balance of the specified address.
   * 
   * @param {Object} params - The parameters for retrieving the balance.
   * @param {string} params.address - The public key of the address to check the balance for.
   * @returns {Promise<number|null>} The balance of the specified address in lamports.
   */
  async getBalance({ address }) {
    if (!this.validateAddress({ address })) {
      return null;
    }
    const { value: lamports } = await this.rpc.getBalance(SolKit.address(address)).send();
    return Number(lamports);
  }

  /**
   * Sends a specified amount of lamports to a given address, either through a versioned or legacy transaction.
   * 
   * @param {Object} params - The parameters for the transaction.
   * @param {string} params.address - The public key of the recipient.
   * @param {number} params.amount - The amount of lamports to send.
   * @param {SolKit.KeyPairSigner<string>} params.fromAccountKeypair - The keypair of the sender - use a web3.js `createKeyPairSignerFromPrivateBytes` method.
   * @param {SolKit.KeyPairSigner<string>} [params.feePayerKeypair] - The keypair of the transaction fee payer - if not included, fromAccountKeypair
   * @param {string} [params.nonceAddress] - The public key of the nonce account
   * @param {string} [params.nonceAuthorityAddress] - The public key of the nonce account's authority - if not included, nonceAddress
   * @param {'legacy' | 0} [params.txType='legacy'] - The type of transaction ('legacy' or '0' for versioned).
   * @param {boolean} [params.priority=false] - Whether to add a priority fee to the transaction.
   * @returns {Promise<string>} The transaction hash.
   * @throws {Error} If the transaction confirmation returns an error.
   */
  async sendToAddress({
    address: addressStr,
    amount,
    fromAccountKeypair: fromAccountKeypairSigner,
    feePayerKeypair: feePayerKeypairSigner,
    nonceAddress: nonceAddressStr,
    txType: version = 'legacy',
    priority,
  }) {
    try {
      const VALID_TX_VERSIONS = ['legacy', 0];
      if (!VALID_TX_VERSIONS.includes(version)) {
        throw new Error('Invalid transaction version');
      }
      const destinationAddress = SolKit.address(addressStr);
      if (!feePayerKeypairSigner) {
        feePayerKeypairSigner = fromAccountKeypairSigner;
      }

      let transactionMessage = await this._createBaseTransactionMessage({ version, feePayerKeypairSigner, nonceAddressStr, priority });
      transactionMessage = SolKit.appendTransactionMessageInstructions(
        [
          SolSystem.getTransferSolInstruction({
            amount,
            destination: destinationAddress,
            source: fromAccountKeypairSigner
          })
        ],
        transactionMessage
      );
      const txid = await this._sendAndConfirmTransaction({ transferTransactionMessage: transactionMessage, nonceAddressStr, commitment: 'confirmed' });
      return txid;
    } catch (err) {
      this.emitter.emit(`Failure sending a type ${version} transaction to address ${addressStr}`, err);
      throw err;
    }
  }

  /**
   * @param {Object} params - The parameters for the transaction.
   * @param {'legacy' | 0} [params.txType='legacy'] - The type of transaction ('legacy' or '0' for versioned).
   * @param {SolKit.KeyPairSigner<string>} params.feePayerKeypair - The keypair of the transaction fee payer
   * @param {string} [params.nonceAddressStr] - The public key of the nonce account
   * @param {string} [params.nonceAuthorityAddress] - The public key of the nonce account's authority - if not included, nonceAddress
   * @param {boolean} [params.priority=false] - Whether to add a priority fee to the transaction.
   * @throws {Error} If the transaction confirmation returns an error.
   */
  async _createBaseTransactionMessage({ version, feePayerKeypairSigner, nonceAddressStr, priority }) {
    // Create transaction message and add fee payer signer
    let transactionMessage = pipe(
      SolKit.createTransactionMessage({ version }),
      tx => SolKit.setTransactionMessageFeePayerSigner(feePayerKeypairSigner, tx),
    );

    // Async message component may not be put in pipe
    transactionMessage = await this.#setTransactionMessageLifetime({ transactionMessage, nonceAddressStr, nonceAuthorityAddressStr: feePayerKeypairSigner.address });

    if (priority) {
      transactionMessage = await this.addPriorityFee({ transactionMessage });
    }

    return transactionMessage;
  }

  _sendAndConfirmNonceTransactionFactory() {
    return SolKit.sendAndConfirmDurableNonceTransactionFactory({ rpc: this.rpc, rpcSubscriptions: this.rpcSubscriptions });
  }

  _sendAndConfirmTransactionFactory() {
    return SolKit.sendAndConfirmTransactionFactory({ rpc: this.rpc, rpcSubscriptions: this.rpcSubscriptions });
  }

  /**
   * Takes transferTransactionMessage with signers, adds compute unit budget, signs transaction, and sends
   * @param {Object} params
   * @param params.transferTransactionMessage
   * @param {string} params.nonceAddressStr
   * @param { 'confirmed' | 'finalized' } [params.commitment] Default 'confirmed'
   * @returns {Promise<string>} txid
   */
  async _sendAndConfirmTransaction({ transferTransactionMessage, nonceAddressStr, commitment = 'confirmed' }) {
    let signedTransactionMessage;
    try {
      const transactionMessage = await this.#appendComputeUnitLimitInstruction(transferTransactionMessage);
      signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessage);

      if (nonceAddressStr) {
        const sendAndConfirmNonceTransaction = this._sendAndConfirmNonceTransactionFactory();
        await sendAndConfirmNonceTransaction(signedTransactionMessage, { commitment });
      } else {
        const sendAndConfirmTransaction = this._sendAndConfirmTransactionFactory();
        await sendAndConfirmTransaction(signedTransactionMessage, { commitment });
      }
      const txid = SolKit.getSignatureFromTransaction(signedTransactionMessage);
      return txid;
    } catch (err) {
      // Intercept known race condition bug for durable nonce transactions: https://github.com/anza-xyz/kit/issues/53
      if (err.message.includes('is no longer valid. It has advanced to')) {
        return signedTransactionMessage ? SolKit.getSignatureFromTransaction(signedTransactionMessage) : null;
      }
      throw err;
    }
  }

  /**
   * @param {Object} input
   * @param {string} [input.nonceAddressStr]
   * @param {string} [input.nonceAuthorityAddressStr]
   * @param {import('@solana/kit').ITransactionMessageWithFeePayerSigner<any>} input.transactionMessage
   * @private
   */
  async #setTransactionMessageLifetime({ nonceAddressStr, nonceAuthorityAddressStr, transactionMessage }) {
    let transactionMessageWithLifetime;
    if (nonceAddressStr) {
      const nonceAccountAddress = SolKit.address(nonceAddressStr);
      const nonceAuthorityAddress = SolKit.address(nonceAuthorityAddressStr);
      const { data } = await SolSystem.fetchNonce(this.rpc, nonceAccountAddress);
      const nonce = data.blockhash;
      transactionMessageWithLifetime = SolKit.setTransactionMessageLifetimeUsingDurableNonce({
        nonce,
        nonceAccountAddress,
        nonceAuthorityAddress
      }, transactionMessage);
    } else {
      const { value: blockhashLifetimeConstraint } = await this.rpc.getLatestBlockhash().send();
      transactionMessageWithLifetime = SolKit.setTransactionMessageLifetimeUsingBlockhash(blockhashLifetimeConstraint, transactionMessage);
    }
    return transactionMessageWithLifetime;
  }

  async #appendComputeUnitLimitInstruction(transactionMessage) {
    const getComputeUnitEstimate = SolKit.getComputeUnitEstimateForTransactionMessageFactory({ rpc: this.rpc });
    const estimatedComputeUnits = await getComputeUnitEstimate(transactionMessage);
    const transactionMessageWithComputeUnitLimit = SolKit.appendTransactionMessageInstruction(
      SolComputeBudget.getSetComputeUnitLimitInstruction({ units: estimatedComputeUnits }),
      transactionMessage
    );
    return transactionMessageWithComputeUnitLimit;
  }

  /**
   * 
   * @param {import('@solana/kit').KeyPairSigner<string>} payerAndAuthority
   * @param {import('@solana/kit').KeyPairSigner<string>} nonceAccount
   */
  async createNonceAccount(payerAndAuthority, nonceAccount) {
    try {
      // Get the min balance for rent exception
      const space = 80n;
      const lamportsForRent = await this.rpc.getMinimumBalanceForRentExemption(space).send();

      // Build the tx
      const createAccountInstruction = SolSystem.getCreateAccountInstruction({
        payer: payerAndAuthority,
        newAccount: nonceAccount,
        lamports: lamportsForRent,
        space,
        programAddress: SolSystem.SYSTEM_PROGRAM_ADDRESS
      });

      const initializeNonceAccountInstruction = SolSystem.getInitializeNonceAccountInstruction(
        {
          nonceAccount: nonceAccount.address,
          nonceAuthority: payerAndAuthority.address
        }
      );

      const latestBlockhash = await this.#getLatestBlockhash();
      const transactionMessage = pipe(
        SolKit.createTransactionMessage({ version: 0 }),
        (tx) => SolKit.setTransactionMessageFeePayerSigner(payerAndAuthority, tx), // fix payer
        (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => SolKit.appendTransactionMessageInstructions(
          [createAccountInstruction, initializeNonceAccountInstruction],
          tx
        )
      );

      // Sign & send
      const signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessage);

      const sendAndConfirmTransaction = this._sendAndConfirmTransactionFactory();
      await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'confirmed' });
      return SolKit.getSignatureFromTransaction(signedTransactionMessage);
    } catch (err) {
      this.emitter.emit('Failure to create a nonce account', err);
      throw err;
    }
  }

  /**
   * Estimates the transaction fee either based on a raw transaction or by calculating the average fee
   * over a specified number of blocks.
   * 
   * @param {Object} options - The options for fee estimation.
   * @param {number} [options.nBlocks=10] - The number of recent blocks to consider for average fee calculation.
   * @param {string} [options.rawTx] - The raw transaction data for direct fee estimation.
   * @returns {Promise<number>} The estimated fee in lamports.
   * @throws Will throw an error on raw tx estimation if the fee estimation fails or tx cannot be decoded.
   */
  async estimateFee({ rawTx, nBlocks = 10 }) {
    if (rawTx) {
      // Recommended. Directly estimate fee based on the provided raw transaction size.
      return await this.estimateTransactionFee({ rawTx });
    }

    // // Fee can be a calculated by (Number of Signatures × Lamports per Signature)
    // // Calculate the average lamports per signature over the past n blocks
    const samples = (await this.rpc.getRecentPerformanceSamples(nBlocks).send()).values();

    let totalFees = 0;
    let totalBlocks = 0;
    const minFee = 5000; // Set a minimum fee per signature in lamports
    for (const sample of samples) {
      const slot = Number(sample.slot);
      const block = await this.getBlock({ height: slot });
      if (!block) {
        continue;
      }
      const { blockhash } = block;
      if (blockhash) {
        const keypair = await SolKit.generateKeyPairSigner();
        const proxyTx = await this.#createRawTransaction(keypair, keypair, 1000n);
        const estimatedTransactionFee = await this.estimateTransactionFee({ rawTx: proxyTx });
        totalFees += estimatedTransactionFee;
        totalBlocks++;
      }
    }
    // Return the average fee or the minimum fee if no blocks were processed
    return totalBlocks > 0 ? (totalFees / totalBlocks) : minFee;
  }

  /**
   * Estimates the transaction fee based on the provided raw transaction data.
   * 
   * @param {Object} options - The options for fee estimation.
   * @param {string} options.rawTx - The raw transaction data for direct fee estimation.
   * @returns {Promise<number>} The estimated fee in lamports.
   * @throws Will throw an error if the fee estimation fails or tx cannot be decoded.
   */
  async estimateTransactionFee({ rawTx }) {
    let tx;
    try {
      if (typeof rawTx === 'string') {
        rawTx = Buffer.from(rawTx, 'base64');
      }
      const transactionDecoder = SolKit.getTransactionDecoder();
      tx = transactionDecoder.decode(rawTx);
      if (!tx) throw new Error();
    } catch {
      throw new Error('Could not decode provided raw transaction');
    }

    const base64EncodedMessage = Buffer.from(tx.messageBytes).toString('base64');
    const { value } = await this.rpc.getFeeForMessage(base64EncodedMessage).send();

    if (value === null) {
      throw new Error('Failed to estimate transaction fee');
    }

    return Number(value);
  }

  /**
   * Estimates the maximum priority fee based on recent transaction fees and a specified percentile.
   * This function retrieves recent prioritization fees and calculates the fee at the given percentile.
   * The fee is the per-compute-unit fee paid by at least one successfully landed transaction
   * 
   * @param {Object} params
   * @param {number} [params.percentile=25] - The percentile (0-100) of fees to consider for maximum priority fee estimation.
   * @returns {Promise<number|null>} The estimated maximum priority fee or null if no fees are available.
   */
  async estimateMaxPriorityFee({ percentile = 25 }) {
    const recentFees = await this.rpc.getRecentPrioritizationFees().send();
    if (!recentFees || recentFees.length === 0) {
      return null;
    }

    const priorityFees = recentFees
      .filter(recentFee => Number(recentFee.prioritizationFee) > 0)
      .map(recentFee => Number(recentFee.prioritizationFee));

    if (!priorityFees || priorityFees.length === 0) {
      return 0;
    }

    const sortedPriorityFees = priorityFees.sort((a, b) => a - b);
    const feeIdx = Math.floor(sortedPriorityFees.length * (percentile / 100)) - Math.floor(percentile / 100);
    const maxPriorityFeeBigInt = sortedPriorityFees[feeIdx];
    return Number(maxPriorityFeeBigInt);
  }

  /**
   * Adds a priority fee to the given transaction based on recent prioritization fees.
   * This function modifies the compute unit limit and sets the compute unit price for the transaction.
   * 
   * @param {Object} params - Parameters for adding priority fee.
   * @param {any} params.transactionMessage - The transaction to which the priority fee will be added.
   * @param {number} [params.minPriorityFee] - The compute unit limit to set for the transaction. - unused
   * @param {Object} params.config - Configuration options for retrieving prioritization fees.
   * @throws Will throw an error if adding the priority fee fails for reasons other than 'Method not found'.
   */
  async addPriorityFee({ transactionMessage, minPriorityFee, config }) {
    try {
      const priorityFee = await this.estimateMaxPriorityFee({ config });
      if (priorityFee == null) {
        throw new Error('Unexpected null priority fee');
      }

      const minPriorityFeeDefault = typeof minPriorityFee === 'number' ? minPriorityFee : 1000;
      const minBoundedPriorityFee = Math.max(minPriorityFeeDefault, priorityFee);

      const transactionWithPriorityFee = SolKit.appendTransactionMessageInstruction(
        SolComputeBudget.getSetComputeUnitPriceInstruction({ microLamports: minBoundedPriorityFee }),
        transactionMessage
      );

      return transactionWithPriorityFee;
    } catch (err) {
      if (err && err.message !== 'failed to get recent prioritization fees: Method not found') {
        this.emitter.emit('failure', err);
        throw err;
      }
      console.warn('Priority fee\'s are not supported by this cluster', err);
      throw err;
    }
  }


  /**
   * Retrieves the hash of the best block (tip) in the blockchain.
   * This function fetches the tip of the blockchain and returns its hash.
   * 
   * @returns {Promise<string|null>} The hash of the best block or null if the tip is not available.
   */
  async getBestBlockHash() {
    const tip = await this.getTip();
    if (!tip) {
      return null;
    }
    return tip.hash;
  }

  /**
   * Retrieves a transaction by its transaction ID.
   * 
   * @param {Object} params - Parameters for retrieving the transaction.
   * @param {string} params.txid - The transaction ID of the transaction to retrieve.
   */
  async getTransaction({ txid }) {
    if (!txid || !this.isBase58(txid)) {
      return null;
    }
    const serializedTransactionObject = await this.rpc.getTransaction(SolKit.signature(txid), { ...this._versionedConfig, encoding: 'base64' }).send();
    if (!serializedTransactionObject?.transaction) {
      return null;
    }
    const { blockTime, transaction, slot, meta } = serializedTransactionObject;
    // transaciton is an array with [rawTx, 'base64']
    const serializedTransaction = transaction[0];
    const base64Encoder = SolKit.getBase64Encoder();
    const transactionBytes = base64Encoder.encode(serializedTransaction);
    const decodeRawTransactionParams = { rawTx: transactionBytes };

    const { lookupTablesUsed, ...parsedTransaction } = await this.decodeRawTransaction(decodeRawTransactionParams);
    parsedTransaction.blockTime = Number(blockTime);
    parsedTransaction.slot = Number(slot);

    if (lookupTablesUsed) {
      const parsedTx = await this.rpc.getTransaction(SolKit.signature(txid), { ...this._versionedConfig, encoding: 'jsonParsed' }).send();

      return {
        ...parsedTransaction,
        meta: parsedTx.meta,
        accountKeys: parsedTx.transaction.message.accountKeys.map(({ pubkey }) => pubkey)
      };
    }

    return {
      ...parsedTransaction,
      meta
    };
  }

  /**
   * Get all transactions for an account
   * @param {Object} params - Parameters for retrieving transactions.
   * @param {string} params.address - Account address to get transactions for.
   * @param {string} [params.before] -  start searching backwards from this transaction signature. If not provided the search starts from the top of the highest max confirmed block.
   * @param {'confirmed' | 'finalized'} [params.commitment]
   * @param {string} [params.until] - search backwards until this transaction signature, if found before limit reached
   */
  async getTransactions(params) {
    const { address: addressStr, ...getSignaturesForAddressConfig } = params;
    if (!this.validateAddress({ address: addressStr })) {
      return null;
    }

    const config = {
      ...getSignaturesForAddressConfig,
      before: getSignaturesForAddressConfig.before ? SolKit.signature(getSignaturesForAddressConfig.before) : undefined,
      until: getSignaturesForAddressConfig.until ? SolKit.signature(getSignaturesForAddressConfig.until) : undefined
    };

    const signatureObjects = await this.#getSignaturesForAddress(addressStr, config);
    const txids = signatureObjects.map(signatureObject => signatureObject.signature);
    const transactions = [];

    // Fetch transaction details for each signature
    for (const txid of txids) {
      try {
        const tx = await this.getTransaction({ txid });
        if (tx) {
          transactions.push(tx);
        }
      } catch (err) {
        this.emitter.emit('failure', err);
      }
    }
    return transactions;
  }

  /**
   * Retrieves the count of confirmed transactions for a given account address.
   * Note: Returned data is affected by the nodes retention period. Non-archival nodes will not return full count.
   * 
   * @param {Object} params - Parameters for retrieving the transaction count.
   * @param {string} params.address - The account address to get the transaction count for.
   * @returns {Promise<number|null>} A promise that resolves to the number of confirmed transactions.
   */
  async getTransactionCount({ address: addressStr }) {
    if (!this.validateAddress({ address: addressStr })) {
      return null;
    }
    let signatures = await this.#getSignaturesForAddress(addressStr);
    let result = signatures.length;
    while (signatures.length === 1000) {
      const beforeSignature = signatures[signatures.length - 1].signature;
      const nextBatch = await this.#getSignaturesForAddress(addressStr, { before: beforeSignature });
      signatures = nextBatch;
      result += signatures.length;
    }

    return result;
  }

  /**
   * Retrieves signatures in reverse chronological order
   * @param {string} addressStr
   * @param {Object} [config]
   * @param {import("@solana/kit").Signature} [config.before]
   * @param {'confirmed' | 'finalized'} [config.commitment='finalized']
   * @param {number} [config.limit=1000]
   * @param {import("@solana/kit").Slot} [config.minContextSlot]
   * @param {import("@solana/kit").Signature} [config.until]
   */
  async #getSignaturesForAddress(addressStr, config) {
    const address = SolKit.address(addressStr);
    return await this.rpc.getSignaturesForAddress(address, config).send();
  }

  /**
   * Retrieves and serializes a raw transaction by its transaction ID.
   * 
   * @param {Object} params - Parameters for retrieving the raw transaction.
   * @param {string} params.txid - The transaction ID of the transaction to retrieve.
   * @returns {Promise<string|null>} A promise that resolves to the raw transaction as a base64 string or null if not found.
   */
  async getRawTransaction({ txid }) {
    if (!this.isBase58(txid)) {
      throw new Error(`Invalid txid: ${txid}`);
    }
    const tx = await this.rpc.getTransaction(SolKit.signature(txid), { ...this._versionedConfig, encoding: 'base64' }).send();
    if (!tx?.transaction) {
      return null;
    }

    // tx.transaction is an array with [rawTx, 'base64']
    return tx.transaction[0];
  }

  /**
   * Decodes a raw transaction.
   * 
   * @param {Object} params - Parameters for decoding the raw transaction.
   * @param {Uint8Array|string} params.rawTx - The raw transaction to be decoded.
   * @returns {Object} if txid is null, it indicates the transaction has not yet been signed by the fee payer
   * // NOTE! decodeRawTransaction does not include transaction meta - it is available in getTransaction though, which wraps this method
   */
  async decodeRawTransaction({ rawTx }) {
    if (typeof rawTx === 'string') {
      rawTx = Buffer.from(rawTx, 'base64');
    }

    const transactionDecoder = SolKit.getTransactionDecoder();
    const decodedTransaction = transactionDecoder.decode(rawTx);

    const compiledTransactionMessageDecoder = SolKit.getCompiledTransactionMessageDecoder();
    const compiledTransactionMessage = compiledTransactionMessageDecoder.decode(decodedTransaction.messageBytes);
    const decompileTransactionMessageConfig = {};

    let decompiledTransactionMessage;
    const lookupTablesUsed = 'addressTableLookups' in compiledTransactionMessage && compiledTransactionMessage.addressTableLookups !== undefined;
    if (lookupTablesUsed) {
      try {
        decompiledTransactionMessage = await SolKit.decompileTransactionMessageFetchingLookupTables(compiledTransactionMessage, this.rpc);
      } catch (err) {
        console.error('Decompiling with lookup table failure', err);
      }
    } else {
      decompiledTransactionMessage = SolKit.decompileTransactionMessage(compiledTransactionMessage, decompileTransactionMessageConfig);
    }

    // Retrieve txid
    let txid = null;
    const { address: feePayerAddress } = decompiledTransactionMessage.feePayer;
    const feePayerSignatureBytes = decodedTransaction.signatures[feePayerAddress];
    if (feePayerSignatureBytes) {
      const base58Decoder = SolKit.getBase58Decoder();
      txid = base58Decoder.decode(feePayerSignatureBytes);
    }

    const lifetimeConstraint = {};
    if (decompiledTransactionMessage.lifetimeConstraint.blockhash) {
      lifetimeConstraint.blockhash = decompiledTransactionMessage.lifetimeConstraint.blockhash;
      lifetimeConstraint.lastValidBlockHeight = decompiledTransactionMessage.lifetimeConstraint.lastValidBlockHeight;
    } else if (decompiledTransactionMessage.lifetimeConstraint.nonce) {
      lifetimeConstraint.nonce = decompiledTransactionMessage.lifetimeConstraint.nonce;
    }

    const instructions = parseInstructions(decompiledTransactionMessage.instructions);

    let status, confirmations;
    try {
      const { status: retrievedStatus, confirmations: retrievedConfirmations } = await this.#getStatusAndConfirmations({ txid });
      status = retrievedStatus;
      confirmations = retrievedConfirmations;
    } catch {
      status = null;
      confirmations = null;
    }

    const output = {
      txid,
      status,
      confirmations,
      version: compiledTransactionMessage.version,
      instructions,
      feePayerAddress
    };

    if (lifetimeConstraint.blockhash || lifetimeConstraint.nonce) {
      output.lifetimeConstraint = { ...lifetimeConstraint };
    }

    return { ...output, accountKeys: compiledTransactionMessage.staticAccounts, lookupTablesUsed };
  }

  /**
   * Sends a raw transaction to the network - do not await confirmation.
   * 
   * @param {Object} params - Parameters for sending the raw transaction.
   * @param {Uint8Array|string} params.rawTx - The raw transaction to be sent.
   * @returns {Promise<string|null>} A promise that resolves to the transaction ID or null if the transaction is invalid.
   */
  async sendRawTransaction({ rawTx }) {
    const serializedTransaction = rawTx instanceof Uint8Array ?
      Buffer.from(rawTx).toString('base64')
      : rawTx;
    const signature = await this.rpc.sendTransaction(serializedTransaction, { encoding: 'base64' }).send();
    return signature;
  }

  /**
   * Retrieves a block by its height or hash.
   * 
   * @param {Object} params - Parameters for retrieving the block.
   * @param {string} [params.hash] - The hash of the block to retrieve.
   * @param {number} [params.height] - The height of the block to retrieve.
   * @param {'full' | 'accounts' | 'signatures' | 'none'} [params.transactionDetails] See https://solana.com/docs/rpc/http/getblock, 'transactionDetails'; default 'signatures'
   * @throws {Error} If hash is provided instead of height.
   */
  async getBlock({ hash, height, transactionDetails = 'signatures' }) {
    if (typeof height === 'bigint') {
      height = Number(height);
    }
    if (!(Number.isInteger(height) || height < 0)) {
      throw new Error(`height could not be coerced to be an integer or is not positive, height is: ${height}`);
    }
    if (hash) {
      throw new Error('Hash is not supported. Provide a height instead');
    }
    const block = await this.rpc.getBlock(height, {
      commitment: this._versionedConfig.commitment,
      maxSupportedTransactionVersion: this._versionedConfig.maxSupportedTransactionVersion,
      transactionDetails
    }).send();
    return block;
  }

  /**
   * @param {Object} params 
   * @param {'full' | 'accounts' | 'signatures' | 'none'} See https://solana.com/docs/rpc/http/getblock, 'transactionDetails'; default 'signatures'
   * @returns 
   */
  async getLatestFinalizedBlock({ transactionDetails = 'signatures' }) {
    const slot = await this.rpc.getSlot({ commitment: 'finalized' }).send();
    const block = await this.getBlock({ height: slot, transactionDetails });
    return block;
  }

  /**
   * @param {number} [maxBlocksToCheck] default 10
   * @throws {Error} If no signatures found in number of blocks checked
   */
  async getLatestSignature(maxBlocksToCheck = 10) {
    const slot = await this.rpc.getSlot({ commitment: 'finalized' }).send();
    let block = await this.getBlock({ height: slot, transactionDetails: 'signatures' });
    let blocksChecked = 1;
    while (block?.signatures?.length < 1 && blocksChecked <= maxBlocksToCheck) {
      block = await this.getBlock({ height: block.parentSlot, transactionDetails: 'signatures' });
      ++blocksChecked;
    }
    const latestSignature = block?.signatures?.[0];
    if (typeof latestSignature !== 'string') {
      throw new Error(`No signatures found in the last ${maxBlocksToCheck} blocks`);
    }
    return {
      blockHeight: Number(block.blockHeight),
      blockTime: Number(block.blockTime),
      signature: latestSignature
    };
  }

  /**
   * Get the number of confirmations for a given transaction ID.
   * 
   * @param {Object} params - The parameters for the function.
   * @param {string} params.txid - The transaction ID to get confirmations for.
   */
  async #getStatusAndConfirmations({ txid }) {
    if (!this.isBase58(txid)) {
      throw new Error('Invalid txid');
    }

    const status = await this.#getSignatureStatusWithRetry({ txid });
    let confirmations = Number(status.confirmations);
    if (!confirmations) {
      confirmations = await this.getConfirmations({ txid }) || 0;
    }

    return {
      status: status.confirmationStatus,
      confirmations
    };
  }

  /**
   * Get the number of confirmations for a given transaction ID.
   * 
   * @param {Object} params - The parameters for the function.
   * @param {string} params.txid - The transaction ID to get confirmations for.
   * @returns {Promise<number|null>} - The number of confirmations or null if not available.
   */
  async getConfirmations({ txid }) {
    if (!this.isBase58(txid)) {
      throw new Error('Invalid txid');
    }

    const status = await this.#getSignatureStatusWithRetry({ txid });
    if (status?.confirmations) {
      return Number(status.confirmations);
    }

    const latestSlot = await this.rpc.getSlot({ commitment: 'confirmed' }).send();
    if (status?.slot) {
      return Number(latestSlot - status.slot);
    }

    const tx = await this.rpc.getTransaction(SolKit.signature(txid), this._versionedConfig).send();
    if (tx?.slot) {
      return Number(latestSlot - tx.slot);
    }

    return null;
  }

  /**
   * Derives the ATA account address string associated with solAddress - does not confirm solAddress, mintAddress, or derived ATA address exist on-chain
   * @param {Object} params
   * @param {string} params.solAddress
   * @param {string} params.mintAddress 
   */
  async deriveAta({ solAddress, mintAddress }) {
    try {
      const [destinationAta] = await SolToken.findAssociatedTokenPda({
        owner: solAddress,
        tokenProgram: SolToken.TOKEN_PROGRAM_ADDRESS,
        mint: mintAddress
      });
      return destinationAta;
    } catch (err) {
      if (err.message.toLowerCase().includes('base58')) {
        throw new Error(SOL_ERROR_MESSAGES.NON_BASE58_PARAM);
      }
      throw err;
    }
  }

  /**
   * Ensure ATA is created for provided solAddress and return it
   * @param {Object} params
   * @param {string} params.solAddress
   * @param {string} params.mintAddress 
   */
  async getConfirmedAta({ solAddress, mintAddress }) {
    try {
      const parsedTokenAccountsByOwner = await this.rpc.getTokenAccountsByOwner(solAddress,
        { mint: mintAddress },
        { encoding: 'base64' }
      ).send();
      const ataAddress = parsedTokenAccountsByOwner?.value[0]?.pubkey;
      if (!ataAddress) {
        throw new Error(SOL_ERROR_MESSAGES.ATA_NOT_INITIALIZED);
      }
      return ataAddress;
    } catch (err) {
      if (SolKit.isSolanaError(err)) {
        if (err.context.__code === -32602) {
          if (err.context.__serverMessage.toLowerCase().includes('mint')) {
            throw new Error(SOL_ERROR_MESSAGES.INVALID_MINT_PARAMETER);
          }
          throw new Error(SOL_ERROR_MESSAGES.UNSPECIFIED_INVALID_PARAMETER);
        }
      }
      throw err;
    }
  }

  /**
   * Initializes ATA on mint for owner
   * @param {Object} params
   * @param {string} params.ownerAddress
   * @param {string} params.mintAddress
   * @param {SolKit.KeyPairSigner} params.feePayer
   */
  async createAta({ ownerAddress, mintAddress, feePayer }) {
    let ataAddress;
    try {
      ataAddress = await this.getConfirmedAta({ solAddress: ownerAddress, mintAddress });
      if (ataAddress) {
        return {
          action: 'RETRIEVED',
          ataAddress,
          message: 'The ATA was previously initialized.'
        };
      }
    } catch (err) {
      if (err.message !== SOL_ERROR_MESSAGES.ATA_NOT_INITIALIZED) {
        throw err;
      }
    }

    const latestBlockhash = await this.#getLatestBlockhash();
    ataAddress = await this.deriveAta({ solAddress: ownerAddress, mintAddress });
    const createAssociatedTokenIdempotentInstruction = SolToken.getCreateAssociatedTokenIdempotentInstruction({
      payer: feePayer,
      owner: ownerAddress,
      mint: mintAddress,
      ata: ataAddress
    });

    const transactionMessage = pipe(
      SolKit.createTransactionMessage({ version: 'legacy' }),
      (tx) => SolKit.setTransactionMessageFeePayerSigner(feePayer, tx),
      (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => SolKit.appendTransactionMessageInstructions(
        [createAssociatedTokenIdempotentInstruction],
        tx
      )
    );

    const signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessage);
    const sendAndConfirmNonceTransaction = this._sendAndConfirmTransactionFactory();
    await sendAndConfirmNonceTransaction(signedTransactionMessage, { commitment: 'confirmed' });
    const signature = SolKit.getSignatureFromTransaction(signedTransactionMessage);
    return {
      action: 'CREATED',
      ataAddress,
      signature,
      message: 'The ATA is initialized.'
    };
  }

  /**
   * 
   * @param {string} args.txid 
   * @returns 
   */
  async #getSignatureStatusWithRetry({ txid }) {
    if (!this.isBase58(txid)) {
      throw new Error('Invalid txid');
    }

    const { value } = await this.rpc.getSignatureStatuses([SolKit.signature(txid)]).send();
    let statuses = value;
    if (value.length === 0 || !value[0]) {
      const { value } = await this.rpc.getSignatureStatuses([SolKit.signature(txid)], { searchTransactionHistory: true }).send();
      if (value.length === 0 || !value[0]) {
        return null;
      }
      statuses = value;
    }
    return statuses[0];
  }

  /**
   * Get the current tip of the blockchain.
   * Solana slot is synonymous with a blockchains height.
   * @returns {Promise<{ height: bigint; hash: import("@solana/kit").Blockhash | null }>} - An object containing the height (slot) and hash of the current block.
   */
  async getTip() {
    const slot = await this.rpc.getSlot({ commitment: 'confirmed' }).send();
    const height = Number(slot);
    const block = await this.getBlock({ height });
    return { height, hash: block?.blockhash ?? null };
  }

  getTxOutputInfo() {
    return null;
  }

  /**
   * Validates a given address.
   * 
   * @param {Object} params - The parameters for the function.
   * @param {string} params.address - The address to validate.
   * @returns {boolean} - Returns true if the address is  on , otherwise false.
   */
  validateAddress({ address }) {
    try {
      return SolKit.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Retrieves SOL balance as well as reference to all Solana account's ata tokens
   * @param {Object} params
   * @param {string} address - Solana address 
   * @param {number} [maxDepth] - Optional. Maximum nesting depth for recursive ATA discovery. If -1, treated as Infinity. Minimum value is 0.
   * @returns 
   */
  async getAccountInfo({ address, maxDepth }) {
    try {
      const accountInfoResponse = await this.rpc.getAccountInfo(address).send();

      const lamports = accountInfoResponse.value ? Number(accountInfoResponse.value.lamports) : 0;
      let effectiveMaxDepth;
      if (maxDepth === -1) {
        effectiveMaxDepth = Infinity;
      } else if (typeof maxDepth === 'number' && maxDepth >= 1) {
        effectiveMaxDepth = maxDepth;
      } else {
        effectiveMaxDepth = 0;
      }
      const atas = await this.getTokenAccountsByOwner({ address, skipExistenceCheck: true, maxDepth: effectiveMaxDepth });
      return { lamports, atas };
    } catch (err) {
      const errMsg = err.message.toLowerCase();
      if (SolKit.isSolanaError(err) && errMsg.includes('json-rpc') && errMsg.includes('should be less than 128 bytes')) {
        // This message can occur when getAccountInfo is called with an SPL address instead of a SOL address
        throw new Error(SOL_ERROR_MESSAGES.ATA_ADD_SENT_INSTEAD_OF_SOL_ADD);
      }
      throw err;
    }
  }

  /**
   * 
   * @param {Object} params
   * @param {string} params.address - SOL address representing owner to lookup token accounts for
   * @param {boolean}[params.skipExistenceCheck] - DEFAULT FALSE. Flag to determine whether address should be checked before attempting ot retrieve token accounts.
   * @param {number} [params.maxDepth=0] - Maximum recursion depth allowed (0 = no recursion, 1 = one level of recursion, etc). Use Infinity for unlimited depth. Minimum value is 0.
   * @returns 
   */
  async getTokenAccountsByOwner({ address, skipExistenceCheck = false, maxDepth = 0 }) {
    // Only explicit skipExistenceCheck: true should bypass
    if (skipExistenceCheck !== true) {
      const accountInfoResponse = await this.rpc.getAccountInfo(address).send();
      if (!accountInfoResponse.value) {
        throw new Error(SOL_ERROR_MESSAGES.SOL_ACCT_NOT_FOUND);
      }
    }

    const getTokenAccountsByOwnerResponse = await this.rpc.getTokenAccountsByOwner(address, { programId: SolToken.TOKEN_PROGRAM_ADDRESS }, { encoding: 'jsonParsed' }).send();
    const tokens = getTokenAccountsByOwnerResponse.value;

    // RECURSION BASE CASE: when there are no token accounts for this address, stop recursing
    if (!tokens.length) {
      return [];
    }

    // Normalize maxDepth: -1 => Infinity; >= 1 => keep; otherwise default to 0
    if (maxDepth === -1) {
      maxDepth = Infinity;
    } else if (!(typeof maxDepth === 'number' && maxDepth >= 1)) {
      maxDepth = 0;
    }

    const atas = [];
    for (const token of tokens) {
      const { mint, state, tokenAmount } = token.account.data.parsed.info;
      const pubkey = token.pubkey;
      const amount = tokenAmount?.uiAmount;

      // Recursively fetch any token accounts owned by this token account (nested ATAs)
      const nestedAtas = maxDepth > 0
        ? await this.getTokenAccountsByOwner({ address: pubkey, skipExistenceCheck: true, maxDepth: maxDepth - 1 })
        : [];

      atas.push({ mint, state, pubkey, amount, atas: nestedAtas });
    }

    return atas;
  }

  async getServerInfo() {
    return await this.rpc.getVersion().send();
  }

  /**
   * @param {string} address - The address to validate.
   * @returns {boolean} True if the address is valid, false otherwise.
   */
  isValidAddress(address) {
    try {
      SolKit.address(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if the given string is a valid Base58 encoded string.
   * 
   * @param {string} str - The string to check.
   * @returns {boolean} True if the string is valid Base58, false otherwise.
   */
  isBase58(str) {
    try {
      bs58.decode(str);
      return true;
    } catch {
      return false;
    }
  }

  async #getLatestBlockhash() {
    const { value } = await this.rpc.getLatestBlockhash().send();
    return value;
  }

  // Helpers
  /**
   * 
   * @param {import('@solana/kit').KeyPairSigner<string>} fromKeypair 
   * @param {import('@solana/kit').KeyPairSigner<string>} toKeypair 
   * @param {number} amountInLamports 
   */
  async #createRawTransaction(fromKeypair, toKeypair, amountInLamports) {
    const unsignedTransaction = await this.#createUnsignedTransaction(fromKeypair, toKeypair, amountInLamports);
    const signedTransaction = await SolKit.signTransactionMessageWithSigners(unsignedTransaction);
    return SolKit.getBase64EncodedWireTransaction(signedTransaction);
  }

  /**
   * 
   * @param {import('@solana/kit').KeyPairSigner<string>} fromKeypair 
   * @param {import('@solana/kit').KeyPairSigner<string>} toKeypair 
   * @param {number} amountInLamports
   * @param {0 | 'legacy'} [version]
   */
  async #createUnsignedTransaction(fromKeypair, toKeypair, amountInLamports, version = 0) {
    const { value: recentBlockhash } = await this.rpc.getLatestBlockhash().send();

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
}