'use strict';

import {
  BitcoreLib,
  BitcoreLibCash,
  BitcoreLibDoge,
  BitcoreLibLtc,
  Deriver,
  Transactions
} from 'crypto-wallet-core';
import Stringify from 'json-stable-stringify';
import { singleton } from 'preconditions';
import { Constants } from './constants';
import { Defaults } from './defaults';
import { Encryption } from './encryption';

const $ = singleton();

const Bitcore_ = {
  btc: BitcoreLib,
  bch: BitcoreLibCash,
  eth: BitcoreLib,
  matic: BitcoreLib,
  arb: BitcoreLib,
  base: BitcoreLib,
  op: BitcoreLib,
  xrp: BitcoreLib,
  doge: BitcoreLibDoge,
  ltc: BitcoreLibLtc,
  sol: BitcoreLib
};
const PrivateKey = BitcoreLib.PrivateKey;
const PublicKey = BitcoreLib.PublicKey;
const crypto = BitcoreLib.crypto;

const MAX_DECIMAL_ANY_CHAIN = 18; // more that 14 gives rounding errors

export class Utils {
  // only used for backwards compatibility
  static getChain(coin: string): string {
    try {
      // TODO add a warning that we are not including chain
      let normalizedChain = coin.toLowerCase();
      if (
        Constants.BITPAY_SUPPORTED_ETH_ERC20.includes(normalizedChain) ||
        !Constants.CHAINS.includes(normalizedChain)
      ) {
        // default to eth if it's an ETH ERC20 or if we don't know the chain
        normalizedChain = 'eth';
      }
      return normalizedChain;
    } catch (_) {
      return 'btc'; // coin should always exist but most unit test don't have it -> return btc as default
    }
  }

  static encryptMessage(message, encryptingKey) {
    return JSON.stringify(Encryption.encryptWithKey(message, encryptingKey));
  }

  // Will throw if it can't decrypt
  static decryptMessage(ciphertextJson, encryptingKey) {
    if (!ciphertextJson) return;
    if (!encryptingKey) throw new Error('Missing encrypting key');
    return Encryption.decryptWithKey(ciphertextJson, encryptingKey).toString();
  }

  static decryptMessageNoThrow(ciphertextJson, encryptingKey) {
    if (!encryptingKey) return '<ECANNOTDECRYPT>';
    if (!ciphertextJson) return '';

    // encrypted json (e.g. { ks: 256, v: 1, ct: 'ciphertext'  ... })
    const r = this.isJsonString(ciphertextJson);
    if (!r || !r.iv || !r.ct) {
      return ciphertextJson;
    }

    try {
      return this.decryptMessage(ciphertextJson, encryptingKey);
    } catch (e) {
      return '<ECANNOTDECRYPT>';
    }
  }

  static isJsonString(str) {
    let r;
    try {
      r = JSON.parse(str);
    } catch (e) {
      return false;
    }
    return r;
  }
  /** 
   * TODO: It would be nice to be compatible with bitcoind signmessage. How
   * is the hash is calculated there?
   */
  static hashMessage(text) {
    $.checkArgument(text);
    const buf = Buffer.from(text);
    let ret = crypto.Hash.sha256sha256(buf);
    ret = new BitcoreLib.encoding.BufferReader(ret).readReverse();
    return ret;
  }

  static signMessage(message, privKey) {
    $.checkArgument(message);
    var priv = new PrivateKey(privKey);
    const flattenedMessage = Array.isArray(message) ? message.join(',') : message;
    var hash = this.hashMessage(flattenedMessage);
    return crypto.ECDSA.sign(hash, priv, { endian: 'little' }).toString();
  }

  static verifyMessage(message: Array<string> | string, signature, pubKey) {
    $.checkArgument(message);
    $.checkArgument(pubKey);

    if (!signature) return false;

    var pub = new PublicKey(pubKey);
    const flattenedMessage = Array.isArray(message) ? message.join(',') : message;
    const hash = this.hashMessage(flattenedMessage);
    try {
      var sig = new crypto.Signature.fromString(signature);
      return crypto.ECDSA.verify(hash, sig, pub, { endian: 'little' });
    } catch (e) {
      return false;
    }
  }

  static privateKeyToAESKey(privKey) {
    $.checkArgument(privKey && typeof privKey === 'string');
    $.checkArgument(BitcoreLib.PrivateKey.isValid(privKey), 'The private key received is invalid');
    const pk = BitcoreLib.PrivateKey.fromString(privKey);
    return BitcoreLib.crypto.Hash.sha256(pk.toBuffer())
      .slice(0, 16)
      .toString('base64');
  }

  static getCopayerHash(name, xPubKey, requestPubKey) {
    return [name, xPubKey, requestPubKey].join('|');
  }

  static getProposalHash(proposalHeader, ...args) {
    // For backwards compatibility
    if (args.length > 0) {
      return this.getOldHash.apply(this, [proposalHeader, ...args]);
    }

    return Stringify(proposalHeader);
  }

  static getOldHash(toAddress, amount, message, payProUrl) {
    return [toAddress, amount, message || '', payProUrl || ''].join('|');
  }

  static parseDerivationPath(path: string) {
    const pathIndex = /m\/([0-9]*)\/([0-9]*)/;
    const [_input, changeIndex, addressIndex] = path.match(pathIndex);
    const isChange = Number.parseInt(changeIndex) > 0;
    return { _input, addressIndex, isChange };
  }

  static deriveAddress(
    scriptType,
    publicKeyRing,
    path,
    m,
    network,
    chain,
    escrowInputs?,
    hardwareSourcePublicKey?,
    clientDerivedPublicKey?
  ) {
    $.checkArgument(Object.values(Constants.SCRIPT_TYPES).includes(scriptType));
    const externSourcePublicKey = hardwareSourcePublicKey || clientDerivedPublicKey;
    if (externSourcePublicKey) {
      let bitcoreAddress;
      try {
        bitcoreAddress = Deriver.deriveAddressWithPath(chain.toUpperCase(), network, externSourcePublicKey, path, scriptType);
      } catch {
        // some chains (e.g. SOL) cannot derive address along path from pub key.
        bitcoreAddress = Deriver.getAddress(chain.toUpperCase(), network, externSourcePublicKey, scriptType);
      }
      return {
        address: bitcoreAddress.toString(),
        path,
        publicKeys: [externSourcePublicKey]
      }
    }

    chain = chain || 'btc';
    const bitcore = Bitcore_[chain];
    let publicKeys = (publicKeyRing || []).map(item => {
      const xpub = new bitcore.HDPublicKey(item.xPubKey);
      return xpub.deriveChild(path).publicKey;
    });

    let bitcoreAddress;
    switch (scriptType) {
      case Constants.SCRIPT_TYPES.P2WSH:
        const nestedWitness = false;
        bitcoreAddress = bitcore.Address.createMultisig(
          publicKeys,
          m,
          network,
          nestedWitness,
          'witnessscripthash'
        );
        break;
      case Constants.SCRIPT_TYPES.P2SH:
        if (escrowInputs) {
          const xpub = new bitcore.HDPublicKey(publicKeyRing[0].xPubKey);
          const inputPublicKeys = escrowInputs.map(input => xpub.deriveChild(input.path).publicKey);
          bitcoreAddress = bitcore.Address.createEscrow(
            inputPublicKeys,
            publicKeys[0],
            network
          );
          publicKeys = [publicKeys[0], ...inputPublicKeys];
        } else {
          bitcoreAddress = bitcore.Address.createMultisig(
            publicKeys,
            m,
            network
          );
        }
        break;
      case Constants.SCRIPT_TYPES.P2WPKH:
        bitcoreAddress = bitcore.Address.fromPublicKey(
          publicKeys[0],
          network,
          'witnesspubkeyhash'
        );
        break;
      case Constants.SCRIPT_TYPES.P2PKH:
        $.checkState(Array.isArray(publicKeys) && publicKeys.length == 1, 'publicKeys array undefined');
        if (Constants.UTXO_CHAINS.includes(chain)) {
          bitcoreAddress = bitcore.Address.fromPublicKey(
            publicKeys[0],
            network
          );
        } else {
          const { addressIndex, isChange } = this.parseDerivationPath(path);
          const [{ xPubKey }] = publicKeyRing;
          bitcoreAddress = Deriver.deriveAddress(
            chain.toUpperCase(),
            network,
            xPubKey,
            addressIndex,
            isChange
          );
        }
        break;
      case Constants.SCRIPT_TYPES.P2TR:
        bitcoreAddress = bitcore.Address.fromPublicKey(
          publicKeys[0],
          network,
          'taproot'
        );
        break;
    }

    return {
      address: bitcoreAddress.toString(true),
      path,
      publicKeys: publicKeys.map(p => p.toString())
    };
  }

  // note that we use the string version of xpub,
  // serialized by BITCORE BTC.
  // testnet xpub starts with t.
  // livenet xpub starts with x.
  // no matter WHICH chain
  static xPubToCopayerId(chain: string, xpub: string): string {
    // this was introduced because we allowed coinType = 0' wallets for BCH
    // for the  "wallet duplication" feature
    // now it is effective for all coins.

    chain = chain.toLowerCase();
    const str = chain == 'btc' ? xpub : (chain + xpub);

    const hash = BitcoreLib.crypto.Hash.sha256(Buffer.from(str));
    return hash.toString('hex');
  }

  static signRequestPubKey(requestPubKey, xPrivKey) {
    const priv = new BitcoreLib.HDPrivateKey(xPrivKey).deriveChild(
      Constants.PATHS.REQUEST_KEY_AUTH
    ).privateKey;
    return this.signMessage(requestPubKey, priv);
  }

  static verifyRequestPubKey(requestPubKey, signature, xPubKey) {
    const pub = new BitcoreLib.HDPublicKey(xPubKey).deriveChild(
      Constants.PATHS.REQUEST_KEY_AUTH
    ).publicKey;
    return this.verifyMessage(requestPubKey, signature, pub.toString());
  }

  static formatAmount(satoshis, unit, opts?) {
    $.shouldBeNumber(satoshis);

    var clipDecimals = (number, decimals) => {
      let str = number.toString();
      if (str.indexOf('e') >= 0) {
        // fixes eth small balances
        str = number.toFixed(MAX_DECIMAL_ANY_CHAIN);
      }
      var x = str.split('.');

      var d = (x[1] || '0').substring(0, decimals);
      const ret = parseFloat(x[0] + '.' + d);
      return ret;
    };

    var addSeparators = (nStr, thousands, decimal, minDecimals) => {
      nStr = nStr.replace('.', decimal);
      var x = nStr.split(decimal);
      var x0 = x[0];
      var x1 = x[1] || '';

      while (x1.endsWith('0') && x1.length > minDecimals) {
        x1 = x1.slice(0, -1);
      }
      var x2 = x.length > 1 ? decimal + x1 : '';

      x0 = x0.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      return x0 + x2;
    };

    opts = opts || {};

    var u = Constants.UNITS[unit];
    var precision = opts.fullPrecision ? 'full' : 'short';
    var decimals = opts.decimals ? opts.decimals[precision] : u[precision];
    var toSatoshis = opts.toSatoshis ? opts.toSatoshis : u.toSatoshis;
    var amount = clipDecimals(
      satoshis / toSatoshis,
      decimals.maxDecimals
    ).toFixed(decimals.maxDecimals);
    return addSeparators(
      amount,
      opts.thousandsSeparator || ',',
      opts.decimalSeparator || '.',
      decimals.minDecimals
    );
  }

  static buildTx(txp) {
    var chain = txp.chain?.toLowerCase() || Utils.getChain(txp.coin); // getChain -> backwards compatibility

    if (Constants.UTXO_CHAINS.includes(chain)) {
      var bitcore = Bitcore_[chain];

      var t = new bitcore.Transaction();

      if (txp.version >= 4) {
        t.setVersion(2);
      } else {
        t.setVersion(1);
      }

      $.checkState(Object.values(Constants.SCRIPT_TYPES).includes(txp.addressType), 'Failed state: addressType not in SCRIPT_TYPES');

      switch (txp.addressType) {
        case Constants.SCRIPT_TYPES.P2WSH:
        case Constants.SCRIPT_TYPES.P2SH:
          for (const i of txp.inputs || []) {
            t.from(i, i.publicKeys, txp.requiredSignatures);
          }
          break;
        case Constants.SCRIPT_TYPES.P2WPKH:
        case Constants.SCRIPT_TYPES.P2PKH:
        case Constants.SCRIPT_TYPES.P2TR:
          t.from(txp.inputs);
          break;
      }

      if (txp.toAddress && txp.amount && !txp.outputs) {
        t.to(txp.toAddress, txp.amount);
      } else if (txp.outputs) {
        for (const o of (txp.outputs || [])) {
          $.checkState(
            o.script || o.toAddress,
            'Output should have either toAddress or script specified'
          );
          if (o.script) {
            t.addOutput(
              new bitcore.Transaction.Output({
                script: o.script,
                satoshis: o.amount
              })
            );
          } else {
            t.to(o.toAddress, o.amount);
          }
        }
      }

      t.fee(txp.fee);

      if (txp.instantAcceptanceEscrow && txp.escrowAddress) {
        t.escrow(
          txp.escrowAddress.address,
          txp.instantAcceptanceEscrow + txp.fee
        );
      }

      t.change(txp.changeAddress.address);

      if (txp.enableRBF) t.enableRBF();

      // Shuffle outputs for improved privacy
      if (t.outputs.length > 1) {
        const outputOrder = (txp.outputOrder || []).filter(order => order < t.outputs.length);
        $.checkState(t.outputs.length === outputOrder.length, 'Failed state: t.ouputs.length == outputOrder.length at buildTx()');
        t.sortOutputs(outputs => outputOrder.map(i => outputs[i]));
      }

      // Validate inputs vs outputs independently of Bitcore
      const totalInputs = (txp.inputs || []).reduce((memo, i) => {
        return +i.satoshis + memo;
      }, 0);
      const totalOutputs = (t.outputs || []).reduce((memo, o) => {
        return +o.satoshis + memo;
      }, 0);

      $.checkState(totalInputs - totalOutputs >= 0, 'Failed state: totalInputs - totalOutputs >= 0 at buildTx');
      $.checkState(totalInputs - totalOutputs <= Defaults.MAX_TX_FEE(chain), 'Failed state: totalInputs - totalOutputs <= Defaults.MAX_TX_FEE(chain) at buildTx');

      return t;
    } else {
      // ETH ERC20 XRP
      const {
        data,
        destinationTag,
        outputs,
        payProUrl,
        tokenAddress,
        multisigContractAddress,
        multiSendContractAddress,
        isTokenSwap,
        gasLimit,
        multiTx,
        outputOrder
      } = txp;
      const recipients = outputs.map(output => {
        return {
          amount: output.amount,
          address: output.toAddress,
          data: output.data,
          gasLimit: output.gasLimit
        };
      });
      // Backwards compatibility BWC <= 8.9.0
      if (data) {
        recipients[0].data = data;
      }
      const unsignedTxs = [];
      // If it is a token swap its an already created ERC20 transaction so we skip it and go directly to ETH transaction create
      const isToken = tokenAddress && !payProUrl && !isTokenSwap;
      const isMULTISIG = multisigContractAddress;
      const chainName = chain.toUpperCase();
      const tokenType = chainName === 'SOL' ? 'SPL' : 'ERC20'
      const _chain = isMULTISIG
        ? chainName + 'MULTISIG'
        : isToken
          ? chainName + tokenType
          : chainName;

      if (multiSendContractAddress) {
        let multiSendParams = {
          nonce: Number(txp.nonce),
          recipients,
          chain: _chain,
          contractAddress: multiSendContractAddress,
          gasLimit
        };
        unsignedTxs.push(Transactions.create({ ...txp, ...multiSendParams }));
      } else if (multiTx) {
        // Add unsigned transactions in outputOrder
        for (let index = 0; index < outputOrder.length; index++) {
          const outputIdx = outputOrder[index];
          if (!outputs?.[outputIdx]) {
            throw new Error('Output index out of range');
          }
          const recepient = {
            amount: outputs[outputIdx].amount,
            address: outputs[outputIdx].toAddress,
            tag: outputs[outputIdx].tag
          }
          const _tag = recepient?.tag || destinationTag;
          const rawTx = Transactions.create({
            ...txp,
            ...recepient,
            tag: _tag ? Number(_tag) : undefined,
            chain: _chain,
            nonce: this.formatNonce(chainName, txp.nonce, index),
            recipients: [recepient]
          });
          unsignedTxs.push(rawTx);
        }
      } else {
        for (let index = 0; index < recipients.length; index++) {
          const rawTx = Transactions.create({
            ...txp,
            ...recipients[index],
            tag: destinationTag ? Number(destinationTag) : undefined,
            chain: _chain,
            nonce: this.formatNonce(chainName, txp.nonce, index),
            recipients: [recipients[index]],
          });
          unsignedTxs.push(rawTx);
        }
      }
      return { uncheckedSerialize: () => unsignedTxs };
    }
  }

  static formatNonce(chain, nonce, index) {
    if (Constants.SVM_CHAINS.includes(chain.toLowerCase())) {
      return nonce
    } else {
      return Number(nonce) + Number(index)
    }
  }

  static getCurrencyCodeFromCoinAndChain(coin: string, chain: string): string {
    if (coin.toLowerCase() === chain.toLowerCase()) {
      return coin.toUpperCase();
    }
    // TODO - remove this special case once migration to POL is complete
    if (coin.toLowerCase() === 'pol') {
      return 'MATIC';
    }
    if (coin.toLowerCase() === 'usdt' && chain.toLowerCase() === 'arb') {
      return 'USDTe_arb';
    }
    if (coin.toLowerCase() === 'usdt' && chain.toLowerCase() === 'op') {
      return 'USDTe_op';
    }
    const suffix = Constants.EVM_CHAINSUFFIXMAP[chain.toLowerCase()];
    const coinIsAChain = !!Constants.EVM_CHAINSUFFIXMAP[coin.toLowerCase()];
    if (suffix && (coinIsAChain || chain.toLowerCase() !== 'eth')) {
      // Special handling for usdc.e and usdc on matic
      if (chain.toLowerCase() === 'matic' && coin.toLowerCase() === 'usdc.e') {
        return 'USDC_m';
      } else if (chain.toLowerCase() === 'matic' && coin.toLowerCase() === 'usdc') {
        return 'USDCn_m';
      }
      return `${coin.toUpperCase()}_${suffix}`;
    }
    return coin.toUpperCase();
  }

  static isNativeSegwit(addressType) {
    return [
      Constants.SCRIPT_TYPES.P2WPKH,
      Constants.SCRIPT_TYPES.P2WSH,
      Constants.SCRIPT_TYPES.P2TR,
    ].includes(addressType);
  }

  static getSegwitVersion(addressType) {
    switch (addressType) {
      case Constants.SCRIPT_TYPES.P2WPKH:
      case Constants.SCRIPT_TYPES.P2WSH:
        return 0;
      case Constants.SCRIPT_TYPES.P2TR:
        return 1;
      default:
        return undefined; // non-segwit addressType
    }
  }

  static isUtxoChain(chain: string): boolean {
    return Constants.UTXO_CHAINS.includes(chain.toLowerCase());
  }

  static isSvmChain(chain: string): boolean {
    return Constants.SVM_CHAINS.includes(chain.toLowerCase());
  }

  static isEvmChain(chain: string): boolean {
    return Constants.EVM_CHAINS.includes(chain.toLowerCase());
  }

  static isXrpChain(chain: string): boolean {
    return ['xrp'].includes(chain.toLowerCase());
  }

  static isSingleAddressChain(chain: string): boolean {
    return !Utils.isUtxoChain(chain);
  }
}
