import { Transactions } from 'crypto-wallet-core';
import _ from 'lodash';
import { IAddress } from 'src/lib/model/address';
import { IChain } from '..';

const Common = require('../../common');
const Constants = Common.Constants;
const Defaults = Common.Defaults;
const Errors = require('../../errors/errordefinitions');

export class EthChain implements IChain {

  getWalletBalance(server, wallet, opts, cb) {
    const bc = server._getBlockchainExplorer(
      wallet.coin,
      wallet.network
    );
    bc.getBalance(wallet, (err, balance) => {
      if (err) {
        return cb(err);
      }
      server.getPendingTxs({}, (err, txps) => {
        if (err) return cb(err);
        const lockedSum = _.sumBy(txps, 'amount');
        const convertedBalance = server._convertBitcoreBalance(
          balance,
          lockedSum
        );
        server.storage.fetchAddresses(
          server.walletId,
          (err, addresses: IAddress[]) => {
            if (err) return cb(err);
            if (addresses.length > 0) {
              const byAddress = [
                {
                  address: addresses[0].address,
                  path: Constants.PATHS.SINGLE_ADDRESS,
                  amount: convertedBalance.totalAmount
                }
              ];
              convertedBalance.byAddress = byAddress;
            }
            return cb(null, convertedBalance);
          }
        );
      });
    });
  }

  getWalletSendMaxInfo(server, wallet, opts, cb) {
    server.getBalance({}, (err, balance) => {
      if (err) return cb(err);
      const { totalAmount, availableAmount } = balance;

      server.estimateGas(
        {
          coin: wallet.coin,
          network: wallet.network,
          from: opts.from,
          to: '0x0', // a dummy address
          value: totalAmount, // it will be lest that this, at the end
          data: null,
          gasPrice: opts.feePerKb
        },
        (err, gasLimit) => {
          let fee = opts.feePerKb * (gasLimit || Defaults.DEFAULT_GAS_LIMIT);
          return cb(null, {
            utxosBelowFee: 0,
            amountBelowFee: 0,
            amount: availableAmount - fee,
            feePerKb: opts.feePerKb,
            fee
          });
        }
      );
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

  checkDust(output, opts) {
    if (opts.outputs.length != 1) {
      return Errors.MORE_THAT_ONE_OUTPUT;
    }
  }

  getFee(server, wallet, opts) {
    return new Promise(resolve => {
      server._getFeePerKb(wallet, opts, (err, inFeePerKb) => {
        let feePerKb = inFeePerKb;
        let gasPrice = inFeePerKb;
        const { from, data, outputs } = opts;
        const { coin, network } = wallet;
        server.estimateGas(
          {
            coin,
            network,
            from,
            to: outputs[0].toAddress,
            value: outputs[0].amount,
            data,
            gasPrice
          },
          (err, inGasLimit) => {
            if (_.isNumber(opts.fee)) {
              // This is used for sendmax
              gasPrice = feePerKb = Number(
                (
                  opts.fee / (inGasLimit || Defaults.DEFAULT_GAS_LIMIT)
                ).toFixed()
              );
            }

            const gasLimit = inGasLimit || Defaults.DEFAULT_GAS_LIMIT;
            opts.fee = feePerKb * gasLimit;
            return resolve({feePerKb, gasPrice, gasLimit});
          }
        );
      });
    });
  }

  convertFeePerKb(p, feePerKb) {
    return [p, feePerKb];
  }

  checkTx(server, txp) {
    try {
      txp.getBitcoreTx();
    } catch (ex) {
      server.logw('Error building Bitcore transaction', ex);
      return ex;
    }
  }

  checkTxUTXOs(server, txp, opts, cb) {
    return cb();
  }

  selectTxInputs(server, txp, wallet, opts, cb, next) {
    server.getBalance({ wallet }, (err, balance) => {
      if (err) return next(err);

      const { totalAmount, availableAmount } = balance;
      if (totalAmount < txp.getTotalAmount()) {
        return cb(Errors.INSUFFICIENT_FUNDS);
      } else if (availableAmount < txp.getTotalAmount()) {
        return cb(Errors.LOCKED_FUNDS);
      } else {
        return next(server._checkTx(txp));
      }
    });
  }

  checkUtxos(opts) {}

  setInputs() {}

  isUTXOCoin() { return false; }
  isSingleAddress() { return true; }

  addressFromStorageTransform(network, address): void {
    if (network != 'livenet') {
      const x =  address.address.indexOf(':' + network);
      if (x >= 0) {
        address.address = address.address.substr(0, x);
      }
    }
  }

  addressToStorageTransform(network, address): void {
    if (network != 'livenet')
      address.address += ':' + network;
  }

  addSignaturesToBitcoreTx(tx, inputs, inputPaths, signatures, xpub) {
    const raw = Transactions.applySignature({
      chain: 'ETH',
      tx: tx.uncheckedSerialize(),
      signature: signatures[0],
    });
    tx.uncheckedSerialize = () => raw ;

    // bitcore users id for txid...
    tx.id = Transactions.getHash({ tx: raw, chain: 'ETH' });
  }
}
