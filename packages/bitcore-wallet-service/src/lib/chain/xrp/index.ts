import { Transactions, Validation } from 'crypto-wallet-core';
import _ from 'lodash';
import { IWallet } from 'src/lib/model';
import { IAddress } from 'src/lib/model/address';
import { IChain } from '..';
import { Common } from '../../common';
import { Errors } from '../../errors/errordefinitions';
import logger from '../../logger';
import { WalletService } from '../../server';

const Defaults = Common.Defaults;

export class XrpChain implements IChain {
  /**
   * Converts Bitcore Balance Response.
   * @param {Object} bitcoreBalance - { unconfirmed, confirmed, balance }
   * @param {Number} locked - Sum of txp.amount
   * @returns {Object} balance - Total amount & locked amount.
   */
  private convertBitcoreBalance(bitcoreBalance, locked, reserve = Defaults.MIN_XRP_BALANCE) {
    const { unconfirmed, confirmed, balance } = bitcoreBalance;
    let activatedLocked = locked;
    // If XRP address has a min balance of 10 XRP, subtract activation fee for true spendable balance.
    if (balance > 0) {
      activatedLocked = locked + reserve;
    }
    const convertedBalance = {
      totalAmount: balance,
      totalConfirmedAmount: confirmed,
      lockedAmount: activatedLocked,
      lockedConfirmedAmount: activatedLocked,
      availableAmount: balance - activatedLocked,
      availableConfirmedAmount: confirmed - activatedLocked,
      byAddress: []
    };
    return convertedBalance;
  }

  supportsMultisig() {
    return false;
  }

  getSizeSafetyMargin() {
    return 0;
  }

  getInputSizeSafetyMargin() {
    return 0;
  }

  getWalletBalance(server: WalletService, wallet: IWallet, opts, cb) {
    const bc = server._getBlockchainExplorer(wallet.chain || wallet.coin, wallet.network);
    bc.getBalance(wallet, (err, balance) => {
      if (err) {
        return cb(err);
      }
      bc.getReserve((err, reserve) => {
        if (err) {
          return cb(err);
        }
        server.getPendingTxs(opts, (err, txps) => {
          if (err) return cb(err);
          const lockedSum = txps.reduce((sum, txp) => {
            return sum + txp.amount + (txp.fee || 0);
          }, 0) || 0;
          const convertedBalance = this.convertBitcoreBalance(balance, lockedSum, reserve);
          server.storage.fetchAddresses(server.walletId, (err, addresses: IAddress[]) => {
            if (err) return cb(err);
            if (addresses.length > 0) {
              const byAddress = [
                {
                  address: addresses[0].address,
                  path: addresses[0].path,
                  amount: convertedBalance.totalAmount
                }
              ];
              convertedBalance.byAddress = byAddress;
            }
            return cb(null, convertedBalance);
          });
        });
      });
    });
  }

  getWalletSendMaxInfo(server, wallet, opts, cb) {
    server.getBalance({}, (err, balance) => {
      if (err) return cb(err);
      const { totalAmount, availableAmount } = balance;
      let fee = opts.feePerKb;
      return cb(null, {
        utxosBelowFee: 0,
        amountBelowFee: 0,
        amount: availableAmount - fee,
        feePerKb: opts.feePerKb,
        fee
      });
    });
  }

  getDustAmountValue() {
    return 0;
  }

  getTransactionCount(server, wallet, from) {
    return new Promise((resolve, reject) => {
      server._getTransactionCount(wallet, from, (err, nonce) => {
        if (err) return reject(err);
        return resolve(nonce);
      });
    });
  }

  getChangeAddress() { }

  checkDust(output, opts) { }

  checkScriptOutput(output) { }

  getFee(server, wallet, opts) {
    return new Promise((resolve, reject) => {
      // This is used for sendmax flow
      if (_.isNumber(opts.fee)) {
        return resolve({ feePerKb: opts.fee });
      }
      server._getFeePerKb(wallet, opts, (err, inFeePerKb) => {
        if (err) {
          return reject(err);
        }
        let feePerKb = inFeePerKb;
        opts.fee = feePerKb;
        return resolve({ feePerKb });
      });
    });
  }

  getBitcoreTx(txp, opts = { signed: true }) {
    const { destinationTag, outputs, outputOrder, multiTx } = txp;
    const chain = 'XRP';
    const unsignedTxs = [];
    const length = multiTx ? outputOrder.length : outputs.length;
    for (let index = 0; index < length; index++) {
      let outputIdx = index;
      if (multiTx) {
        outputIdx = outputOrder[index];
      }
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
        tag: _tag ? Number(_tag) : undefined,
        chain,
        nonce: Number(txp.nonce) + Number(index),
        recipients: [recepient]
      });
      unsignedTxs.push(rawTx);
    }
    let tx = {
      uncheckedSerialize: () => unsignedTxs,
      txid: () => txp.txid,
      txids: () => txp.txid ? [txp.txid] : [],
      toObject: () => {
        let ret = _.clone(txp);
        ret.outputs[0].satoshis = ret.outputs[0].amount;
        return ret;
      },
      getFee: () => {
        return txp.fee;
      },
      getChangeOutput: () => null
    };

    if (opts.signed) {
      const sigs = txp.getCurrentSignatures();
      sigs.forEach(x => {
        this.addSignaturesToBitcoreTx(tx, txp.inputs, txp.inputPaths, x.signatures, x.xpub);
      });
    }

    return tx;
  }

  convertFeePerKb(p, feePerKb) {
    return [p, feePerKb];
  }

  checkTx(txp) {
    try {
      this.getBitcoreTx(txp);
    } catch (ex) {
      logger.warn('Error building XRP transaction: %o', ex);
      return ex;
    }
  }

  checkTxUTXOs(server, txp, opts, cb) {
    return cb();
  }

  selectTxInputs(server, txp, wallet, opts, cb) {
    server.getBalance({ wallet }, (err, balance) => {
      if (err) return cb(err);
      const { totalAmount, availableAmount } = balance;
      const minXrpBalance = Defaults.MIN_XRP_BALANCE;
      if (totalAmount - minXrpBalance < txp.getTotalAmount()) {
        return cb(Errors.INSUFFICIENT_FUNDS);
      } else if (availableAmount < txp.getTotalAmount()) {
        return cb(Errors.LOCKED_FUNDS);
      } else {
        return cb(this.checkTx(txp));
      }
    });
  }

  checkUtxos(opts) { }

  checkValidTxAmount(output): boolean {
    if (!_.isNumber(output.amount) || _.isNaN(output.amount) || output.amount < 0) {
      return false;
    }
    return true;
  }

  isUTXOChain() {
    return false;
  }
  isSingleAddress() {
    return true;
  }

  addressFromStorageTransform(network, address): void {
    if (network != 'livenet') {
      const x = address.address.indexOf(':' + network);
      if (x >= 0) {
        address.address = address.address.substr(0, x);
      }
    }
  }

  addressToStorageTransform(network, address): void {
    if (network != 'livenet') address.address += ':' + network;
  }

  addSignaturesToBitcoreTx(tx, inputs, inputPaths, signatures, xpub) {
    if (signatures.length === 0) {
      throw new Error('Signatures Required');
    }

    const chain = 'XRP'; // TODO use lowercase always to avoid confusion
    const network = tx.network;
    const unsignedTxs = tx.uncheckedSerialize();
    const signedTxs = [];
    const txids = [];
    for (let index = 0; index < signatures.length; index++) {
      const signed = Transactions.applySignature({
        chain,
        tx: unsignedTxs[index],
        signature: signatures[index]
      });
      signedTxs.push(signed);

      // bitcore users id for txid...
      tx.id = Transactions.getHash({ tx: signed, chain, network });
      txids.push(tx.id);
    }
    tx.txids = () => txids;
    tx.uncheckedSerialize = () => signedTxs;
  }

  notifyConfirmations() {
    return false;
  }

  validateAddress(wallet, inaddr, opts) {
    const chain = 'xrp';
    const isValidTo = Validation.validateAddress(chain, wallet.network, inaddr);
    if (!isValidTo) {
      throw Errors.INVALID_ADDRESS;
    }
    const isValidFrom = Validation.validateAddress(chain, wallet.network, opts.from);
    if (!isValidFrom) {
      throw Errors.INVALID_ADDRESS;
    }
    return;
  }

  onCoin(coin) {
    return null;
  }
  onTx(tx) {
    // TODO
    // format tx to
    // {address, amount}
    return null;
  }

  getReserve(server: WalletService, wallet: IWallet, cb: (err?, reserve?: number) => void) {
    const bc = server._getBlockchainExplorer(wallet.chain || wallet.coin, wallet.network);
    bc.getReserve((err, reserve) => {
      if (err) {
        return cb(err);
      }
      return cb(null, reserve);
    });
  }
}
