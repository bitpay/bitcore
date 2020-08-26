import { Transactions, Validation } from 'crypto-wallet-core';
import { Web3 } from 'crypto-wallet-core';
import _ from 'lodash';
import { IAddress } from 'src/lib/model/address';
import { IChain, INotificationData } from '..';
import logger from '../../logger';

const Common = require('../../common');
const Constants = Common.Constants;
const Defaults = Common.Defaults;
const Errors = require('../../errors/errordefinitions');

export class EthChain implements IChain {
  /**
   * Converts Bitcore Balance Response.
   * @param {Object} bitcoreBalance - { unconfirmed, confirmed, balance }
   * @param {Number} locked - Sum of txp.amount
   * @returns {Object} balance - Total amount & locked amount.
   */
  private convertBitcoreBalance(bitcoreBalance, locked) {
    const { unconfirmed, confirmed, balance } = bitcoreBalance;
    // we ASUME all locked as confirmed, for ETH.
    const convertedBalance = {
      totalAmount: balance,
      totalConfirmedAmount: confirmed,
      lockedAmount: locked,
      lockedConfirmedAmount: locked,
      availableAmount: balance - locked,
      availableConfirmedAmount: confirmed - locked,
      byAddress: []
    };
    return convertedBalance;
  }

  notifyConfirmations() {
    return false;
  }

  supportsMultisig() {
    return false;
  }

  getWalletBalance(server, wallet, opts, cb) {
    const bc = server._getBlockchainExplorer(wallet.coin, wallet.network);

    if (opts.tokenAddress) {
      wallet.tokenAddress = opts.tokenAddress;
    }

    if (opts.multisigContractAddress) {
      wallet.multisigContractAddress = opts.multisigContractAddress;
      opts.network = wallet.network;
    }

    bc.getBalance(wallet, (err, balance) => {
      if (err) {
        return cb(err);
      }
      server.getPendingTxs(opts, (err, txps) => {
        if (err) return cb(err);
        // Do not lock eth multisig amount
        const lockedSum = opts.multisigContractAddress ? 0 : _.sumBy(txps, 'amount') || 0;
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
      let fee = opts.feePerKb * Defaults.MIN_GAS_LIMIT;
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
    return new Promise(resolve => {
      server._getFeePerKb(wallet, opts, async (err, inFeePerKb) => {
        let feePerKb = inFeePerKb;
        let gasPrice = inFeePerKb;
        const { from } = opts;
        const { coin, network } = wallet;
        let inGasLimit;
        for (let output of opts.outputs) {
          try {
            inGasLimit = await server.estimateGas({
              coin,
              network,
              from,
              to: opts.multisigContractAddress || opts.tokenAddress || output.toAddress,
              value: opts.tokenAddress || opts.multisigContractAddress ? 0 : output.amount,
              data: output.data,
              gasPrice
            });
            output.gasLimit = inGasLimit || Defaults.DEFAULT_GAS_LIMIT;
          } catch (err) {
            output.gasLimit = Defaults.DEFAULT_GAS_LIMIT;
          }
        }
        if (_.isNumber(opts.fee)) {
          // This is used for sendmax
          gasPrice = feePerKb = Number((opts.fee / (inGasLimit || Defaults.DEFAULT_GAS_LIMIT)).toFixed());
        }

        const gasLimit = inGasLimit || Defaults.DEFAULT_GAS_LIMIT;
        const fee = feePerKb * gasLimit;
        return resolve({ feePerKb, gasPrice, gasLimit, fee });
      });
    });
  }

  getBitcoreTx(txp, opts = { signed: true }) {
    const { data, outputs, payProUrl, tokenAddress, multisigContractAddress } = txp;
    const isERC20 = tokenAddress && !payProUrl;
    const isETHMULTISIG = multisigContractAddress && !payProUrl;
    const chain = isETHMULTISIG ? 'ETHMULTISIG' : isERC20 ? 'ERC20' : 'ETH';
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
    for (let index = 0; index < recipients.length; index++) {
      const rawTx = Transactions.create({
        ...txp,
        ...recipients[index],
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
      const tx = this.getBitcoreTx(txp);
    } catch (ex) {
      logger.debug('Error building Bitcore transaction', ex);
      return ex;
    }

    return null;
  }

  checkTxUTXOs(server, txp, opts, cb) {
    return cb();
  }

  selectTxInputs(server, txp, wallet, opts, cb) {
    server.getBalance(
      { wallet, tokenAddress: opts.tokenAddress, multisigContractAddress: opts.multisigContractAddress },
      (err, balance) => {
        if (err) return cb(err);

        const { totalAmount, availableAmount } = balance;
        if (totalAmount < txp.getTotalAmount()) {
          return cb(Errors.INSUFFICIENT_FUNDS);
        } else if (availableAmount < txp.getTotalAmount()) {
          return cb(Errors.LOCKED_FUNDS);
        } else {
          if (opts.tokenAddress || opts.multisigContractAddress) {
            // ETH wallet balance
            server.getBalance({}, (err, ethBalance) => {
              if (err) return cb(err);
              const { totalAmount, availableAmount } = ethBalance;
              if (totalAmount < txp.fee) {
                return cb(Errors.INSUFFICIENT_ETH_FEE);
              } else if (availableAmount < txp.fee) {
                return cb(Errors.LOCKED_ETH_FEE);
              } else {
                return cb(this.checkTx(txp));
              }
            });
          } else {
            return cb(this.checkTx(txp));
          }
        }
      }
    );
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

    const chain = 'ETH';
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
      tx.id = Transactions.getHash({ tx: signed, chain });
    }
    tx.uncheckedSerialize = () => signedTxs;
  }

  validateAddress(wallet, inaddr, opts) {
    const chain = 'ETH';
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
    // TODO: Multisig ERC20 - Internal txs ¿?
    let tokenAddress;
    let multisigContractAddress;
    let address;
    let amount;
    if (tx.abiType && tx.abiType.type === 'ERC20') {
      tokenAddress = tx.to;
      address = Web3.utils.toChecksumAddress(tx.abiType.params[0].value);
      amount = tx.abiType.params[1].value;
    } else if (tx.abiType && tx.abiType.type === 'MULTISIG' && tx.abiType.name === 'submitTransaction') {
      multisigContractAddress = tx.to;
      address = Web3.utils.toChecksumAddress(tx.abiType.params[0].value);
      amount = tx.abiType.params[1].value;
    } else if (tx.abiType && tx.abiType.type === 'MULTISIG' && tx.abiType.name === 'confirmTransaction') {
      multisigContractAddress = tx.to;
      address = Web3.utils.toChecksumAddress(tx.internal[0].action.to);
      amount = tx.internal[0].action.value;
    } else {
      address = tx.to;
      amount = tx.value;
    }
    return {
      txid: tx.txid,
      out: {
        address,
        amount,
        tokenAddress,
        multisigContractAddress
      }
    };
  }
}
