import {
  BitcoreLib as Bitcore,
  BitcoreLibCash,
  BitcoreLibDoge,
  BitcoreLibLtc,
  Utils as CWCUtils,
  Validation as CWCValidation,
  Web3
} from '@bitpay-labs/crypto-wallet-core';
import { singleton } from 'preconditions';
import { Constants, Utils } from './common';
import { Credentials } from './credentials';
import log from './log';
import type { Address } from '../types/address';

const $ = singleton();

// Each supported multisig/UTXO chain canonicalizes destinations through its
// own bitcore-lib fork's Address class rather than raw string/lowercase
// comparison, so equivalent encodings (BTC/LTC Bech32 case, LTC legacy
// `3...`/modern `M...` P2SH, BCH cashaddr/legacy) compare equal while
// unparseable addresses throw and are treated as a verification failure
// instead of matching merely because their raw strings match.
const ADDRESS_LIB_BY_CHAIN: Record<string, { Address: new (address: string) => { toString(): string } }> = {
  btc: Bitcore,
  bch: BitcoreLibCash,
  doge: BitcoreLibDoge,
  ltc: BitcoreLibLtc
};

interface PayproEntry {
  toAddress: string;
  amount: bigint;
  /** The original output/instruction object, for chain-family fields beyond address+amount (EVM calldata, etc). */
  raw: any;
}

type PayproEntriesNormalizationResult =
  | { valid: true; entries: PayproEntry[] }
  | {
    valid: false;
    invalidEntryIndex: number;
    invalidField: 'destination address' | 'amount';
  };

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

  private static optionalStringsEqual(value1: any, value2: any): boolean {
    const value1Missing = value1 == null;
    const value2Missing = value2 == null;
    if (value1Missing || value2Missing) return value1Missing && value2Missing;
    return typeof value1 === 'string' && typeof value2 === 'string' && value1 === value2;
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

  /**
   * Check transaction proposal
   * 
   * Confirms tx proposal signature, and if paypro included in ops, confirms it
   *
   * @param {Function} credentials
   * @param {Object} txp
   * @param {Object} Optional: paypro
   * @param {Boolean} isLegit
   */
  static checkTxProposal(credentials, txp, opts) {
    opts = opts || {};

    return this.checkTxProposalSignature(credentials, txp) &&
      (!opts.paypro || this.checkPaypro(txp, opts.paypro));
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
  
    const verified = Utils.verifyMessage(hash, txp.proposalSignature, creatorSigningPubKey);
    if (!verified && !txp.prePublishRaw) {
      log.debug(`[TXP ${txp.id}] Invalid proposal signature, no prePublishRaw to fall back to`);
      return false;
    }
    
    if (!verified && txp.prePublishRaw && !Utils.verifyMessage(txp.prePublishRaw, txp.proposalSignature, creatorSigningPubKey)) {
      log.debug(`[TXP ${txp.id}] Invalid proposal signature, even with prePublishRaw fallback`);
      return false;
    }

    if (Constants.UTXO_CHAINS.includes(chain)) {
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
    }

    return true;
  }

  /**
   * Checks a PayPro-funded transaction proposal against the signed PayPro
   * response it was supposed to pay.
   *
   * `txp` is sourced from BWS and is untrusted - a compromised server or a
   * malicious co-signer could have altered it. `payproOpts` is derived from
   * a directly-verified, signed PayPro response and is treated as ground
   * truth. Any mismatch between them is therefore presumed tampering, not a
   * benign difference, and the default outcome on any doubt is rejection.
   *
   * The general rule: compare exactly whatever determines what the merchant
   * receives or how the payment is attributed, for whichever chain family
   * the proposal resolves to, and explicitly exclude fields that only affect
   * fees or transport (EVM gas price/limit, UTXO input selection and
   * change). Destination address and amount alone are not sufficient once a
   * chain's instructions carry payment meaning outside those two fields -
   * most notably, ERC-20 (and other token) instructions typically show a
   * visible `amount` of `0`, with the real recipient and amount encoded in
   * calldata, which would make destination+amount alone a vacuous check.
   */
  static checkPaypro(txp, payproOpts) {
    const falseWithLogWarn = (reason: string): false => {
      const txpId = txp && typeof txp === 'object' && typeof txp.id === 'string'
        ? txp.id
        : 'unknown';
      log.warn(`[TXP ${txpId}] PayPro verification failed: ${reason}`);
      return false;
    };

    // Validate and normalize the complete proposal and invoice before comparing them.
    if (!txp || typeof txp !== 'object') return falseWithLogWarn('missing transaction proposal');
    if (!payproOpts || typeof payproOpts !== 'object') return falseWithLogWarn('missing PayPro data');
    if (!Array.isArray(payproOpts.instructions) || payproOpts.instructions.length === 0) {
      return falseWithLogWarn('missing PayPro instructions');
    }

    let chain: string;
    if (txp.chain == null || txp.chain === '') {
      if (typeof txp.coin !== 'string' || txp.coin === '') {
        return falseWithLogWarn('missing transaction chain');
      }
      const coin = txp.coin.toLowerCase();
      // Cannot fallback to 'eth' like Utils.getChain()
      if (Constants.BITPAY_SUPPORTED_ETH_ERC20.includes(coin)) {
        chain = 'eth';
      } else if (Constants.CHAINS.includes(coin)) {
        chain = coin;
      } else {
        return falseWithLogWarn(`missing transaction chain for coin: ${txp.coin}`);
      }
    } else {
      if (typeof txp.chain !== 'string') return falseWithLogWarn('invalid transaction chain');
      chain = txp.chain.toLowerCase();
    }

    const isUtxoChain = Constants.UTXO_CHAINS.includes(chain);
    const isEvmChain = Constants.EVM_CHAINS.includes(chain);
    const isRippleChain = Constants.RIPPLE_CHAINS.includes(chain);
    const isSvmChain = Constants.SVM_CHAINS.includes(chain);
    if (!(isUtxoChain || isEvmChain || isRippleChain || isSvmChain)) {
      return falseWithLogWarn(`unsupported transaction chain: ${chain}`);
    }

    // payproOpts chain/network/currency optional - validate if present
    if (payproOpts.chain != null) {
      // If payproOpts.chain present
      // must be a string in agreement with chain derived above
      if (typeof payproOpts.chain !== 'string' || payproOpts.chain.toLowerCase() !== chain) {
        return falseWithLogWarn('signed PayPro chain does not match transaction chain');
      }
    }
    if (payproOpts.network != null) {
      // If payproOpts.network present
      // must be a string, txp.network must also be a string, and they must match (case-insensitive)
      if (
        typeof payproOpts.network !== 'string' ||
        typeof txp.network !== 'string' ||
        payproOpts.network.toLowerCase() !== txp.network.toLowerCase()
      ) {
        return falseWithLogWarn('signed PayPro network does not match transaction network');
      }
    }
    if (payproOpts.currency != null) {
      // If payproOpts.currency present
      // must be a string & must match converted txp.coin
      if (typeof payproOpts.currency !== 'string' || typeof txp.coin !== 'string') {
        return falseWithLogWarn('signed PayPro currency does not match transaction currency');
      }
      let expectedCurrency = Utils.getCurrencyCodeFromCoinAndChain(txp.coin, chain);
      // PayProV2.selectPaymentOption rewrites an outgoing 'USDP' request to
      // 'PAX' before it reaches the PayPro server, so a real signed response
      // for a `coin: 'usdp'` proposal carries currency 'PAX', not 'USDP'.
      if (expectedCurrency === 'USDP') expectedCurrency = 'PAX';
      if (payproOpts.currency !== expectedCurrency) {
        return falseWithLogWarn('signed PayPro currency does not match transaction currency');
      }
    }

    // txp.version snapshot
    const versionValue = txp.version;
    if (
      typeof versionValue !== 'number' &&
      typeof versionValue !== 'string'
    ) return falseWithLogWarn('invalid transaction proposal version');
    const version = Number(versionValue);
    if (!Number.isInteger(version) || version < 1) {
      return falseWithLogWarn('invalid transaction proposal version');
    }

    const rawOutputs = version >= 3
      ? txp.outputs
      : [{ toAddress: txp.toAddress, amount: txp.amount }];
    if (!Array.isArray(rawOutputs) || rawOutputs.length === 0) {
      return falseWithLogWarn('missing transaction outputs');
    }

    const normalizedOutputs = this.normalizePayproEntries(rawOutputs);
    if (normalizedOutputs.valid === false) {
      return falseWithLogWarn(
        `transaction output at index ${normalizedOutputs.invalidEntryIndex} ` +
        `has an invalid ${normalizedOutputs.invalidField}`
      );
    }
    const outputs = normalizedOutputs.entries;

    const normalizedPayproInstructions = this.normalizePayproEntries(payproOpts.instructions);
    if (normalizedPayproInstructions.valid === false) {
      return falseWithLogWarn(
        `PayPro instruction at index ${normalizedPayproInstructions.invalidEntryIndex} ` +
        `has an invalid ${normalizedPayproInstructions.invalidField}`
      );
    }
    const payproInstructions = normalizedPayproInstructions.entries;

    if (outputs.length !== payproInstructions.length) {
      return falseWithLogWarn('transaction output and PayPro instruction counts differ');
    }

    const txpAmount = this.normalizeAtomicValue(txp.amount);
    if (txpAmount === null) return falseWithLogWarn('invalid transaction amount');
    const instructionTotal = payproInstructions.reduce((total, entry) => total + entry.amount, 0n);
    if (txpAmount !== instructionTotal) {
      return falseWithLogWarn('transaction and PayPro instruction amounts differ');
    }
    const outputTotal = outputs.reduce((total, entry) => total + entry.amount, 0n);
    if (txpAmount !== outputTotal) {
      return falseWithLogWarn('transaction amount and output total differ');
    }

    // this generates problems...
    //  if (feeRate && payproOpts.requiredFeeRate &&
    //      feeRate < payproOpts.requiredFeeRate)
    //  return false;

    // Accept only a complete match for the resolved chain, comparing each
    // chain family's own canonical parsed destination plus whatever else in
    // that family determines what the merchant receives or how the payment
    // is attributed - never raw/lowercased strings, and never destination +
    // amount alone once calldata/tag/memo can carry payment meaning. UTXO
    // outputs are compared as an order-independent, duplicate-safe multiset
    // (change/input selection reorders them); account-chain entries are
    // compared in order, since e.g. an ERC-20 approve+pay sequence is not
    // the same transaction with its two calls swapped.
    try {
      if (isUtxoChain) {
        const addressLib = ADDRESS_LIB_BY_CHAIN[chain];
        const normalizeAddress = (address: string) => new addressLib.Address(address).toString();
        if (this.payproEntrySetsMatch(outputs, payproInstructions, normalizeAddress)) return true;
        return falseWithLogWarn(`${chain.toUpperCase()} outputs do not match PayPro instructions`);
      }

      if (isEvmChain) {
        const compareCalldata = (output: PayproEntry, instruction: PayproEntry) =>
          this.normalizeEvmCalldata(output.raw?.data) === this.normalizeEvmCalldata(instruction.raw?.data);
        if (this.accountEntriesMatch(outputs, payproInstructions, this.normalizeEvmAddress, compareCalldata)) {
          return true;
        }
        return falseWithLogWarn(`${chain.toUpperCase()} outputs do not match PayPro instructions`);
      }

      if (isRippleChain) {
        if (
          this.accountEntriesMatch(outputs, payproInstructions, this.normalizeRippleAddress) &&
          this.ripplePaymentDetailsMatch(txp, payproInstructions[0]?.raw)
        ) {
          return true;
        }
        return falseWithLogWarn('XRP outputs do not match PayPro instructions');
      }

      // isSvmChain
      if (
        this.accountEntriesMatch(outputs, payproInstructions, this.normalizeSolAddress) &&
        this.solPaymentDetailsMatch(txp, payproInstructions[0]?.raw)
      ) {
        return true;
      }
      return falseWithLogWarn('SOL outputs do not match PayPro instructions');
    } catch {
      return falseWithLogWarn(`invalid ${chain.toUpperCase()} address or instruction data`);
    }
  }

  /**
   * Returns normalized entries or identifies the index and field of the first invalid entry.
   */
  private static normalizePayproEntries(entries: any[]): PayproEntriesNormalizationResult {
    const normalizedEntries: PayproEntry[] = [];
    for (const [index, entry] of entries.entries()) {
      if (typeof entry?.toAddress !== 'string' || entry.toAddress.trim() === '') {
        return {
          valid: false,
          invalidEntryIndex: index,
          invalidField: 'destination address'
        };
      }

      const amount = this.normalizeAtomicValue(entry.amount);
      if (amount === null) {
        return {
          valid: false,
          invalidEntryIndex: index,
          invalidField: 'amount'
        };
      }

      normalizedEntries.push({ toAddress: entry.toAddress, amount, raw: entry });
    }
    return { valid: true, entries: normalizedEntries };
  }

  /**
   * Returns true if both args are empty arrays - should be handled upstream
   */
  private static payproEntrySetsMatch(
    outputs: PayproEntry[],
    instructions: PayproEntry[],
    normalizeAddress: (address: string) => string
  ): boolean {
    if (outputs.length !== instructions.length) return false;

    const entriesSortCompareFn = (entry1: { toAddress: string; amount: bigint }, entry2: { toAddress: string; amount: bigint }) => {
      if (entry1.toAddress !== entry2.toAddress) {
        return entry1.toAddress < entry2.toAddress ? -1 : 1;
      }
      if (entry1.amount === entry2.amount) return 0;
      return entry1.amount < entry2.amount ? -1 : 1;
    };
    const normalizeAndSort = (entries: PayproEntry[]) => entries
      .map(entry => ({
        toAddress: normalizeAddress(entry.toAddress),
        amount: entry.amount
      }))
      .sort(entriesSortCompareFn);

    const normalizedOutputs = normalizeAndSort(outputs);
    const normalizedInstructions = normalizeAndSort(instructions);
    return normalizedOutputs.every((output, index) =>
      output.toAddress === normalizedInstructions[index].toAddress &&
      output.amount === normalizedInstructions[index].amount
    );
  }

  /**
   * Order-sensitive account-chain match: address and amount must agree at
   * every index, plus any family-specific `compareExtra` field (e.g. EVM
   * calldata). Unlike UTXO outputs, account-chain entries are an ordered
   * sequence of calls/payments, so a reordering of otherwise-identical
   * entries is a different transaction and must not compare equal.
   */
  private static accountEntriesMatch(
    outputs: PayproEntry[],
    instructions: PayproEntry[],
    normalizeAddress: (address: string) => string,
    compareExtra?: (output: PayproEntry, instruction: PayproEntry, index: number) => boolean
  ): boolean {
    if (outputs.length !== instructions.length) return false;
    for (let i = 0; i < outputs.length; i++) {
      if (normalizeAddress(outputs[i].toAddress) !== normalizeAddress(instructions[i].toAddress)) return false;
      if (outputs[i].amount !== instructions[i].amount) return false;
      if (compareExtra && !compareExtra(outputs[i], instructions[i], i)) return false;
    }
    return true;
  }

  /**
   * Canonicalizes an EVM address via EIP-55 checksum validation. Accepts
   * all-lowercase, all-uppercase, and correctly-checksummed mixed-case
   * forms as equivalent; rejects an incorrectly-checksummed mixed-case
   * address rather than silently accepting it.
   */
  private static normalizeEvmAddress(address: string): string {
    if (!Web3.utils.isAddress(address)) throw new Error('invalid EVM address');
    return Web3.utils.toChecksumAddress(address);
  }

  /**
   * Canonicalizes EVM calldata for comparison (case-insensitive hex),
   * rejecting anything that isn't well-formed `0x`-prefixed hex so that two
   * identical malformed strings don't compare equal merely by coincidence.
   * `null`/`undefined` (no calldata) normalizes to `null`.
   */
  private static normalizeEvmCalldata(data: any): string | null {
    if (data == null) return null;
    if (typeof data !== 'string' || !/^0x([0-9a-fA-F]{2})*$/.test(data)) {
      throw new Error('invalid EVM calldata');
    }
    return data.toLowerCase();
  }

  /**
   * XRP addresses are case-sensitive base58check; there is no alternate
   * encoding to normalize between, so this only validates and passes the
   * address through unchanged.
   */
  private static normalizeRippleAddress(address: string): string {
    if (!CWCValidation.validateAddress('xrp', 'livenet', address)) throw new Error('invalid XRP address');
    return address;
  }

  /**
   * SOL addresses are case-sensitive base58; there is no alternate encoding
   * to normalize between, so this only validates and passes the address
   * through unchanged.
   */
  private static normalizeSolAddress(address: string): string {
    if (!CWCValidation.validateAddress('sol', 'livenet', address)) throw new Error('invalid SOL address');
    return address;
  }

  /**
   * XRP payment meaning isn't fully captured by destination+amount: the app
   * copies the PayPro instruction's destination tag and invoice ID onto the
   * top-level transaction proposal (`txp.destinationTag`/`txp.invoiceID`),
   * and both route the payment to a specific account holder behind a shared
   * XRP address. Compares those against the signed instruction's nested
   * `outputs[0]` fields.
   */
  private static ripplePaymentDetailsMatch(txp: any, signedInstruction: any): boolean {
    const signedOutput = signedInstruction?.outputs?.[0];
    return this.optionalAtomicValuesEqual(txp.destinationTag, signedOutput?.destinationTag) &&
      this.optionalStringsEqual(txp.invoiceID, signedOutput?.invoiceID);
  }

  /**
   * SOL payment meaning isn't fully captured by destination+amount either:
   * the app maps the PayPro instruction's `outputs[0].invoiceID` to
   * `txp.memo`, which is serialized on-chain as a memo instruction.
   */
  private static solPaymentDetailsMatch(txp: any, signedInstruction: any): boolean {
    const signedOutput = signedInstruction?.outputs?.[0];
    return this.optionalStringsEqual(txp.memo, signedOutput?.invoiceID);
  }

}
