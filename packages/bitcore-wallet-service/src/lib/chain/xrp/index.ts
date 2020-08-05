import { Transactions, Validation } from 'crypto-wallet-core';
import _ from 'lodash';
import { IAddress } from 'src/lib/model/address';
import { IChain, INotificationData } from '..';
import logger from '../../logger';

const Common = require('../../common');
const Constants = Common.Constants;
const Defaults = Common.Defaults;
const Errors = require('../../errors/errordefinitions');

export class XrpChain implements IChain {
  /**
   * Converts Bitcore Balance Response.
   * @param {Object} bitcoreBalance - { unconfirmed, confirmed, balance }
   * @param {Number} locked - Sum of txp.amount
   * @returns {Object} balance - Total amount & locked amount.
   */
  private convertBitcoreBalance(bitcoreBalance, locked) {
    const { unconfirmed, confirmed, balance } = bitcoreBalance;
    let activatedLocked = locked;
    // If XRP address has a min balance of 20 XRP, subtract activation fee for true spendable balance.
    if (balance > 0) {
      activatedLocked = locked + Defaults.MIN_XRP_BALANCE;
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

  getWalletBalance(server, wallet, opts, cb) {
    const bc = server._getBlockchainExplorer(wallet.coin, wallet.network);
    bc.getBalance(wallet, (err, balance) => {
      if (err) {
        return cb(err);
      }
      server.getPendingTxs(opts, (err, txps) => {
        if (err) return cb(err);
        const lockedSum = _.sumBy(txps, 'amount') || 0;
        const convertedBalance = this.convertBitcoreBalance(balance, lockedSum);
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

  getChangeAddress() {}

  checkDust(output, opts) {}

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
    const { destinationTag, outputs } = txp;
    const chain = 'XRP';
    const recipients = outputs.map(output => {
      return {
        amount: output.amount,
        address: output.toAddress
      };
    });
    const unsignedTxs = [];
    for (let index = 0; index < recipients.length; index++) {
      const rawTx = Transactions.create({
        ...txp,
        tag: destinationTag ? Number(destinationTag) : undefined,
        chain,
        nonce: Number(txp.nonce) + Number(index),
        recipients: [recipients[index]]
      });
      unsignedTxs.push(rawTx);
    }
    let tx = {
      uncheckedSerialize: () => unsignedTxs,
      txid: () => txp.txid,
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
      logger.warn('Error building XRP  transaction', ex);
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
      const minXrpBalance = 20000000; // 20 XRP * 1e6
      if (totalAmount - minXrpBalance < txp.getTotalAmount()) {
        return cb(Errors.INSUFFICIENT_FUNDS);
      } else if (availableAmount < txp.getTotalAmount()) {
        return cb(Errors.LOCKED_FUNDS);
      } else {
        return cb(this.checkTx(txp));
      }
    });
  }

  checkUtxos(opts) {}

  checkValidTxAmount(output): boolean {
    if (!_.isNumber(output.amount) || _.isNaN(output.amount) || output.amount < 0) {
      return false;
    }
    return true;
  }

  isUTXOCoin() {
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

    const chain = 'XRP';
    const network = tx.network;
    const unsignedTxs = tx.uncheckedSerialize();
    const signedTxs = [];
    for (let index = 0; index < signatures.length; index++) {
      const signed = Transactions.applySignature({
        chain,
        tx: unsignedTxs[index],
        signature: signatures[index]
      });
      signedTxs.push(signed);

      // bitcore users id for txid...
      tx.id = Transactions.getHash({ tx: signed, chain, network });
    }
    tx.uncheckedSerialize = () => signedTxs;
  }

  notifyConfirmations() {
    return false;
  }

  validateAddress(wallet, inaddr, opts) {
    const chain = 'XRP';
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
}
