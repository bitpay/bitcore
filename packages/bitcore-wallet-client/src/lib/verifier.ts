import {
  BitcoreLib as Bitcore,
  BitcoreLibCash,
  Utils as CWCUtils
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

  static checkPaypro(txp, payproOpts) {
    let toAddress, amount;

    if (parseInt(txp.version) >= 3) {
      toAddress = txp.outputs[0].toAddress;
      amount = txp.amount;
    } else {
      toAddress = txp.toAddress;
      amount = txp.amount;
    }

    if (amount != (payproOpts.instructions || []).reduce((sum, i) => sum += i.amount, 0)) return false;

    if (txp.coin == 'btc' && toAddress != payproOpts.instructions[0].toAddress)
      return false;

    // Workaround for cashaddr/legacy address problems...
    if (
      txp.coin == 'bch' &&
      new BCHAddress(toAddress).toString() !=
        new BCHAddress(payproOpts.instructions[0].toAddress).toString()
    )
      return false;

    // this generates problems...
    //  if (feeRate && payproOpts.requiredFeeRate &&
    //      feeRate < payproOpts.requiredFeeRate)
    //  return false;

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
