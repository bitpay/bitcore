import {
  BitcoreLib as Bitcore,
  BitcoreLibCash,
  Utils as CWCUtils,
  Transactions
} from '@bitpay-labs/crypto-wallet-core';
import { singleton } from 'preconditions';
import { Constants, Utils } from './common';
import { Credentials } from './credentials';
import log from './log';
import type { Address } from '../types/address';

const $ = singleton();
const BCHAddress = BitcoreLibCash.Address;

/**
 * @desc Verifier constructor. Checks data given by the server
 *
 * @constructor
 */
export class Verifier {
  private static _useRegtest: boolean = false;

  private static normalizeAtomicValue(value) {
    if (typeof value === 'bigint') return value >= 0n ? value : null;
    if (typeof value === 'number') {
      // Preserve the integer value actually represented by JavaScript, including unsafe Numbers.
      return Number.isInteger(value) && value >= 0 ? BigInt(value) : null;
    }
    if (
      typeof value === 'string' &&
      (/^(0|[1-9]\d*)$/.test(value) || /^0x[0-9a-fA-F]+$/.test(value))
    ) {
      return BigInt(value);
    }
    return null;
  }

  private static atomicValuesEqual(value1, value2) {
    const normalizedValue1 = this.normalizeAtomicValue(value1);
    const normalizedValue2 = this.normalizeAtomicValue(value2);
    return normalizedValue1 !== null &&
      normalizedValue2 !== null &&
      normalizedValue1 === normalizedValue2;
  }

  private static optionalAtomicValuesEqual(value1, value2) {
    const value1Missing = value1 == null;
    const value2Missing = value2 == null;
    if (value1Missing || value2Missing) return value1Missing && value2Missing;
    return this.atomicValuesEqual(value1, value2);
  }

  private static mapInputsByOutpoint(inputs) {
    if (!Array.isArray(inputs)) return null;

    const inputsByOutpoint = new Map<string, bigint>();
    let total = 0n;
    for (const input of inputs) {
      const vout = this.normalizeAtomicValue(input?.vout);
      const satoshis = this.normalizeAtomicValue(input?.satoshis);
      if (typeof input?.txid !== 'string' || !input.txid || vout === null || satoshis === null) {
        return null;
      }

      const outpoint = `${input.txid}:${vout}`;
      if (inputsByOutpoint.has(outpoint)) return null;

      inputsByOutpoint.set(outpoint, satoshis);
      total += satoshis;
    }

    return { inputsByOutpoint, total };
  }

  private static explicitInputsEqual(inputs1, inputs2) {
    const mappedInputs1 = this.mapInputsByOutpoint(inputs1);
    const mappedInputs2 = this.mapInputsByOutpoint(inputs2);
    if (!mappedInputs1 || !mappedInputs2) return false;
    if (mappedInputs1.inputsByOutpoint.size !== mappedInputs2.inputsByOutpoint.size) return false;
    if (mappedInputs1.total !== mappedInputs2.total) return false;

    for (const [outpoint, satoshis] of mappedInputs1.inputsByOutpoint) {
      if (mappedInputs2.inputsByOutpoint.get(outpoint) !== satoshis) return false;
    }
    return true;
  }

  static useRegtest() {
    this._useRegtest = true;
  }

  static useTestnet() {
    this._useRegtest = false;
  }
  
  /**
   * Check address by deriving it from credentials and comparing
   */
  static checkAddress(
    credentials: Credentials,
    address: Address,
    /** Escrow inputs (BCH only) */
    escrowInputs?: Array<any>
  ) {
    $.checkState(credentials.isComplete(), 'Failed state: credentials at <checkAddress>');

    let network = credentials.network;
    if (network === 'testnet' && this._useRegtest) {
      network = 'regtest';
    }

    const local = Utils.deriveAddress(
      address.type || credentials.addressType,
      credentials.publicKeyRing,
      address.path,
      credentials.m,
      network,
      credentials.chain,
      escrowInputs,
      credentials.hardwareSourcePublicKey,
      credentials.clientDerivedPublicKey
    );
    return (
      local.address == address.address &&
      CWCUtils.difference(local.publicKeys, address.publicKeys).length === 0
    );
  }

  /**
   * Check copayers
   *
   * @param {Credentials} credentials
   * @param {Array} copayers
   * @returns {Boolean} true or false
   */
  static checkCopayers(credentials: Credentials, copayers, opts?: { isTss?: boolean }) {
    opts = opts || {};
    $.checkState(credentials.walletPrivKey, 'Failed state: credentials at <checkCopayers>');
    const walletPubKey = Bitcore.PrivateKey.fromString(credentials.walletPrivKey)
      .toPublicKey()
      .toString();

    if (copayers.length != credentials.n && !opts.isTss) {
      log.error('Missing public keys in server response');
      return false;
    }

    // Repeated xpub kes?
    const uniq = [];
    let error;
    for (const copayer of copayers || []) {
      if (uniq[copayer.xPubKey]++) {
        log.error('Repeated public keys in server response');
        error = true;
      }

      // Not signed pub keys
      if (
        !(copayer.encryptedName || copayer.name) ||
        !copayer.xPubKey ||
        !copayer.requestPubKey ||
        !copayer.signature
      ) {
        log.error('Missing copayer fields in server response');
        error = true;
      } else {
        const hash = Utils.getCopayerHash(
          copayer.encryptedName || copayer.name,
          copayer.xPubKey,
          copayer.requestPubKey
        );
        if (!Utils.verifyMessage(hash, copayer.signature, walletPubKey)) {
          log.error('Invalid signatures in server response');
          error = true;
        }
      }
      if (error) break;
    }

    if (error) return false;

    if (!copayers.map(c => c.xPubKey).includes(credentials.xPubKey)) {
      log.error('Server response does not contains our public keys');
      return false;
    }
    return true;
  }

  static checkProposalCreation(args, txp, encryptingKey) {
    const strEqual = (str1, str2) => {
      return (!str1 && !str2) || str1 === str2;
    };

    if (txp.outputs.length != args.outputs.length) return false;

    for (let i = 0; i < txp.outputs.length; i++) {
      const o1 = txp.outputs[i];
      const o2 = args.outputs[i];
      if (!strEqual(o1.toAddress, o2.toAddress)) return false;
      if (!strEqual(o1.script, o2.script)) return false;
      if (!this.optionalAtomicValuesEqual(o1.tag, o2.tag)) return false;
      // Amounts need to be equal OR sendMax arg is set and amount arg is omitted, otherwise return check failure
      if (o1.amount != o2.amount && !(args.sendMax && o2.amount == null)) return false;
      let decryptedMessage: boolean | string = false;
      try {
        decryptedMessage = Utils.decryptMessage(o2.message, encryptingKey);
      } catch {/** no op - use default (false) */}
      if (!strEqual(o1.message, decryptedMessage)) return false;
    }

    let changeAddress;
    if (txp.changeAddress) {
      changeAddress = txp.changeAddress.address;
    }
    if (args.changeAddress && !strEqual(changeAddress, args.changeAddress))
      return false;
    if (typeof args.feePerKb === 'number' && txp.feePerKb != args.feePerKb)
      return false;
    if (args.fee != null && !this.atomicValuesEqual(args.fee, txp.fee))
      return false;
    if (args.inputs != null && !this.explicitInputsEqual(args.inputs, txp.inputs))
      return false;
    if (!this.optionalAtomicValuesEqual(args.destinationTag, txp.destinationTag))
      return false;
    if (!strEqual(txp.payProUrl, args.payProUrl)) return false;

    let decryptedMessage: boolean | string = false;
    try {
      decryptedMessage = Utils.decryptMessage(args.message, encryptingKey);
    } catch {/** no op - use default (false) */}
    if (!strEqual(txp.message, decryptedMessage)) return false;
    if (
      (args.customData || txp.customData) &&
      !CWCUtils.isEqual(txp.customData, args.customData)
    )
      return false;

    return true;
  }

  static checkTxProposalSignature(credentials, txp) {
    $.checkArgument(txp.creatorId, 'Invalid txp: Missing creatorId');
    $.checkState(credentials.isComplete(), 'Failed state: credentials at checkTxProposalSignature');

    const chain = txp.chain?.toLowerCase() || Utils.getChain(txp.coin); // getChain -> backwards compatibility
    const creatorKeys = (credentials.publicKeyRing || []).find(item => Utils.xPubToCopayerId(chain, item.xPubKey) === txp.creatorId);
    if (!creatorKeys) {
      log.debug(`[TXP ${txp.id}] Creator keys not found in public key ring`);
      return false;
    }
    let creatorSigningPubKey;

    // If the txp using a selfsigned pub key?
    if (txp.proposalSignaturePubKey) {
      // Verify it...
      if (!Utils.verifyRequestPubKey(txp.proposalSignaturePubKey, txp.proposalSignaturePubKeySig, creatorKeys.xPubKey)) {
        log.debug(`[TXP ${txp.id}] Invalid proposalSignaturePubKeySig`);
        return false;
      }

      creatorSigningPubKey = txp.proposalSignaturePubKey;
    } else {
      creatorSigningPubKey = creatorKeys.requestPubKey;
    }
    if (!creatorSigningPubKey) {
      log.debug(`[TXP ${txp.id}] Creator signing public key not found`);
      return false;
    }

    let hash;
    if (parseInt(txp.version) >= 3) {
      const t = Utils.buildTx(txp);
      hash = t.uncheckedSerialize();
    } else {
      throw new Error('Transaction proposal not supported');
    }

    log.debug(`[TXP ${txp.id}] Regenerating & verifying tx proposal hash -> Hash: ${hash}, Signature: ${txp.proposalSignature}`);
  
    // Establish signature trust affirmatively: a proposal is trusted only when the creator's signature
    // matches the transaction we rebuilt, or (for publish-mutable chains) matches the pre-publish
    // serialization that is provably bound to this exact proposal. Every other case leaves it untrusted and
    // is rejected -- we never fall through to "trusted" for a situation we didn't explicitly establish.
    let signatureTrusted = Utils.verifyMessage(hash, txp.proposalSignature, creatorSigningPubKey);
    if (!signatureTrusted) {
      // Local rebuild != creator's signature. Legit only when BWS mutated a field at publish (SVM recent
      // blockhash, or EVM/XRP deferred nonce): the creator signed the pre-publish serialization, stored as
      // txp.prePublishRaw. Trust it only if the signature is valid over it AND it is bound to this proposal.
      if (!txp.prePublishRaw) {
        log.debug(`[TXP ${txp.id}] Invalid proposal signature, no prePublishRaw to fall back to`);
      } else if (!Utils.verifyMessage(txp.prePublishRaw, txp.proposalSignature, creatorSigningPubKey)) {
        log.debug(`[TXP ${txp.id}] Invalid proposal signature, even with prePublishRaw fallback`);
      } else if (!this.checkPrePublishRaw(chain, txp)) {
        log.warn(`[TXP ${txp.id}] prePublishRaw is not bound to this proposal; possible server tampering`);
      } else {
        signatureTrusted = true;
      }
    }
    if (!signatureTrusted) {
      return false;
    }

    // Accept only when every required invariant is affirmatively proven: the signature is trusted (above)
    // and, for UTXO chains, the change/escrow addresses are ours. The proposal is trusted because these held,
    // not because no known-bad condition was hit.
    return this.checkUtxoAddresses(credentials, chain, txp);
  }

  /**
   * For UTXO chains, verifies the change and escrow addresses belong to this wallet. Returns true for
   * non-UTXO chains (they carry no such addresses to prove). Split out of checkTxProposalSignature so that
   * function terminates on an explicit proven-accept verdict rather than a fall-through.
   *
   * @param {Object} credentials
   * @param {string} chain - lower-cased chain of the proposal
   * @param {Object} txp - the transaction proposal
   */
  static checkUtxoAddresses(credentials, chain, txp) {
    if (!Constants.UTXO_CHAINS.includes(chain)) {
      return true;
    }
    if (txp.changeAddress && !this.checkAddress(credentials, txp.changeAddress)) {
      log.debug(`[TXP ${txp.id}] Invalid change address`);
      return false;
    } else if (!txp.changeAddress && !txp.sendMax) {
      log.warn(`[TXP ${txp.id}] Missing change address for non sendMax transaction proposal`);
      return false;
    }
    if (txp.escrowAddress && !this.checkAddress(credentials, txp.escrowAddress, txp.inputs)) {
      log.debug(`[TXP ${txp.id}] Invalid escrow address`);
      return false;
    }
    return true;
  }

  /**
   * True only if txp.prePublishRaw is the same transaction as the current proposal, differing solely in a
   * field BWS mutates at publish (SVM blockhash / EVM-XRP nonce). Binds the creator's fallback signature to
   * this proposal: without it a compromised server could pair a valid (prePublishRaw, proposalSignature)
   * with a tampered destination/amount. Rejects non-mutable chains and fails closed on any error.
   *
   * @param {string} chain - lower-cased chain of the proposal
   * @param {Object} txp - the transaction proposal (must carry prePublishRaw)
   */
  static checkPrePublishRaw(chain, txp) {
    // Only chains with a publish-mutable serialized field legitimately carry prePublishRaw: the recent
    // blockhash (SVM) or account nonce (EVM/XRP). Anywhere else (e.g. UTXO) its presence is illegitimate.
    const canHaveMutableLifetime = [
      ...Constants.SVM_CHAINS,
      ...Constants.EVM_CHAINS,
      ...Constants.RIPPLE_CHAINS
    ].includes(chain);
    if (!canHaveMutableLifetime) {
      log.warn(`[TXP ${txp.id}] prePublishRaw present on chain ${chain} that cannot mutate at publish; refusing fallback`);
      return false;
    }
    try {
      const prePublishRaw = Array.isArray(txp.prePublishRaw) ? txp.prePublishRaw : [txp.prePublishRaw];
      // Recover the mutable field (blockhash / nonce) from the pre-publish serialization the creator signed;
      // the stored proposal carries the refreshed value, so it isn't readable off txp directly.
      const provider: any = Transactions.get({ chain });
      const mutableFields = provider.getMutableFields(prePublishRaw[0]);
      if (!mutableFields || Object.values(mutableFields).every(v => v == null)) {
        log.warn(`[TXP ${txp.id}] Could not recover pre-publish mutable fields from prePublishRaw; refusing fallback`);
        return false;
      }
      // Rebuild with the pre-publish mutable field: an untampered proposal reproduces prePublishRaw exactly;
      // any changed field (destination, amount, from, contract) serializes differently and fails the compare.
      const rebuilt = Utils.buildTx({ ...txp, ...mutableFields }).uncheckedSerialize();
      const rebuiltArr = Array.isArray(rebuilt) ? rebuilt : [rebuilt];
      // Require a non-empty, positive match: an empty set would make `.every()` vacuously true.
      if (rebuiltArr.length === 0 || rebuiltArr.length !== prePublishRaw.length) {
        return false;
      }
      return rebuiltArr.every((raw, i) => raw === prePublishRaw[i]);
    } catch (err) {
      log.warn(`[TXP ${txp.id}] Failed to verify prePublishRaw binding: ${err?.message || err}`);
      return false;
    }
  }

  private static payproAddressesEqual(chain, address1, address2) {
    if (typeof address1 !== 'string' || typeof address2 !== 'string') return false;
    if (Constants.EVM_CHAINS.includes(chain)) {
      return address1.toLowerCase() === address2.toLowerCase();
    }
    if (chain !== 'bch') return address1 === address2;
    const normalize = address => {
      try {
        return new BCHAddress(address).toCashAddress(true);
      } catch {
        try {
          return BCHAddress.fromObject(new Bitcore.Address(address).toObject()).toCashAddress(true);
        } catch { return; }
      }
    };
    const normalizedAddress = normalize(address1);
    return !!normalizedAddress && normalizedAddress === normalize(address2);
  }

  private static expectedPayproOutputs(chain, instructions): any[] | undefined {
    if (!Array.isArray(instructions) || !instructions.length) return;

    if (Constants.UTXO_CHAINS.includes(chain)) {
      if (instructions.some(instruction => !Array.isArray(instruction?.outputs) || !instruction.outputs.length)) return;
      return instructions.flatMap(instruction =>
        instruction.outputs.map(output => ({
          toAddress: output?.address,
          amount: output?.amount
        }))
      );
    }

    if (Constants.EVM_CHAINS.includes(chain)) {
      return instructions.map(instruction => ({
        toAddress: instruction?.to,
        amount: instruction?.value,
        data: instruction?.data
      }));
    }

    if (Constants.RIPPLE_CHAINS.includes(chain) || Constants.SVM_CHAINS.includes(chain)) {
      if (instructions.length !== 1) return;
      const outputs = instructions[0]?.outputs;
      if (!Array.isArray(outputs) || outputs.length !== 1) return;
      const output = outputs[0];
      return [{
        toAddress: output?.address,
        amount: output?.amount,
        destinationTag: output?.destinationTag,
        invoiceID: output?.invoiceID
      }];
    }
  }

  /**
   * Verify every output against signed PayPro instructions so a copayer cannot hide unauthorized outputs.
   */
  static checkPaypro(txp, payproOpts) {
    const chain = typeof txp?.chain === 'string'
      ? txp.chain.toLowerCase()
      : Utils.getChain(txp?.coin); // backwards compatibility

    if (!Constants.CHAINS.includes(chain)) {
      log.debug(`[TXP ${txp?.id}] Unsupported PayPro chain`);
      return false;
    }
    // EVM addresses are identical across chains and networks, so comparing the destination alone
    // won't catch a proposal paying a mainnet address against a testnet (or other chain) invoice.
    if (chain !== payproOpts?.chain?.toLowerCase()) {
      log.debug(`[TXP ${txp?.id}] PayPro chain does not match transaction proposal`);
      return false;
    }
    if (txp?.network !== payproOpts?.network) {
      log.debug(`[TXP ${txp?.id}] PayPro network does not match transaction proposal`);
      return false;
    }
    if (!(parseInt(txp?.version) >= 3)) {
      log.debug(`[TXP ${txp?.id}] Transaction proposal version not supported by PayPro`);
      return false;
    }

    const outputs = txp.outputs;
    const expectedOutputs = this.expectedPayproOutputs(chain, payproOpts?.instructions);
    if (!expectedOutputs?.length) {
      log.debug(`[TXP ${txp?.id}] Invalid PayPro instructions`);
      return false;
    }
    if (!Array.isArray(outputs)) {
      log.debug(`[TXP ${txp?.id}] Invalid transaction proposal outputs`);
      return false;
    }
    if (outputs.length !== expectedOutputs.length) {
      log.debug(`[TXP ${txp?.id}] PayPro output count does not match transaction proposal`);
      return false;
    }

    for (let i = 0; i < outputs.length; i++) {
      const output = outputs[i];
      const expectedOutput = expectedOutputs[i];
      if (!this.atomicValuesEqual(output?.amount, expectedOutput.amount)) {
        log.debug(`[TXP ${txp?.id}] PayPro output ${i} amount does not match transaction proposal`);
        return false;
      }
      if (!this.payproAddressesEqual(chain, output?.toAddress, expectedOutput.toAddress)) {
        log.debug(`[TXP ${txp?.id}] PayPro output ${i} address does not match transaction proposal`);
        return false;
      }
      if (
        Constants.EVM_CHAINS.includes(chain) &&
        (i === 0 && txp.data ? txp.data : output?.data) !== expectedOutput.data
      ) {
        log.debug(`[TXP ${txp?.id}] PayPro output ${i} data does not match transaction proposal`);
        return false;
      }
    }

    if (Constants.RIPPLE_CHAINS.includes(chain)) {
      if (txp.multiTx) {
        log.debug(`[TXP ${txp?.id}] PayPro does not support XRP multiTx transaction proposals`);
        return false;
      }
      if (
        txp.txType != null &&
        (typeof txp.txType !== 'string' || txp.txType.toLowerCase() !== 'payment')
      ) {
        log.debug(`[TXP ${txp?.id}] PayPro does not support non-payment XRP transaction proposals`);
        return false;
      }
      // XRP puts both the destination tag and the invoice ID on-chain, and the merchant reconciles
      // the payment with them - so neither is free for the proposal to choose.
      if (this.normalizeAtomicValue(expectedOutputs[0].destinationTag) === 0n) {
        log.debug(`[TXP ${txp?.id}] PayPro destination tag 0 is not supported`);
        return false;
      }
      if (!this.optionalAtomicValuesEqual(txp.destinationTag, expectedOutputs[0].destinationTag)) {
        log.debug(`[TXP ${txp?.id}] PayPro destination tag does not match transaction proposal`);
        return false;
      }
      if ((txp.invoiceID ?? null) !== (expectedOutputs[0].invoiceID ?? null)) {
        log.debug(`[TXP ${txp?.id}] PayPro invoice ID does not match transaction proposal`);
        return false;
      }
    }

    // On SOL the invoice ID travels as a memo instruction rather than as a transaction field
    if (
      Constants.SVM_CHAINS.includes(chain) &&
      (txp.memo ?? null) !== (expectedOutputs[0].invoiceID ?? null)
    ) {
      log.debug(`[TXP ${txp?.id}] PayPro memo does not match transaction proposal`);
      return false;
    }

    return true;
  }

  /**
   * Check transaction proposal
   *
   * @param {Function} credentials
   * @param {Object} txp
   * @param {Object} Optional: paypro
   * @param {Boolean} isLegit
   */
  static checkTxProposal(credentials, txp, opts) {
    opts = opts || {};

    if (!this.checkTxProposalSignature(credentials, txp)) return false;

    if (opts.paypro && !this.checkPaypro(txp, opts.paypro)) return false;

    return true;
  }
}
