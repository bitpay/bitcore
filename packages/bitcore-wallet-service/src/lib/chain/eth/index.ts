import { reject } from 'async';
import _ from 'lodash';
import { IAddress } from 'src/lib/model/address';
import { IChain } from '..';
import { WalletService } from '../../../lib/server';

const Common = require('../../common');
const Constants = Common.Constants;
const Defaults = Common.Defaults;
const Errors = require('../../errors/errordefinitions');

export class EthChain implements IChain {
  protected walletService: WalletService;

  init(server: WalletService) {
    this.walletService = server;
  }

  getWalletBalance(opts, cb) {
    const wallet = opts.wallet;
    const bc = this.walletService._getBlockchainExplorer(
      wallet.coin,
      wallet.network
    );
    bc.getBalance(wallet, (err, balance) => {
      if (err) {
        return cb(err);
      }
      this.walletService.getPendingTxs({}, (err, txps) => {
        if (err) return cb(err);
        const lockedSum = _.sumBy(txps, 'amount');
        const convertedBalance = this.walletService._convertBitcoreBalance(
          balance,
          lockedSum
        );
        this.walletService.storage.fetchAddresses(
          this.walletService.walletId,
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

  getWalletSendMaxInfo(wallet, opts, cb) {
    this.walletService.getBalance({}, (err, balance) => {
      if (err) return cb(err);
      const { totalAmount, availableAmount } = balance;

      this.walletService.estimateGas(
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

  getTransactionCount(wallet, from) {
    return new Promise((resolve, reject) => {
      this.walletService._getTransactionCount(wallet, from, (err, nonce) => {
        if (err) return reject(err);
        return resolve(nonce);
      });
    });
  }

  getChangeAddress() {}

  checkErrorOutputs(output, opts) {
    if (opts.outputs.length != 1) {
      return Errors.MORE_THAT_ONE_OUTPUT;
    }
  }

  getFeePerKb(wallet, opts) {
    return new Promise(resolve => {
      this.walletService._getFeePerKb(wallet, opts, (err, inFeePerKb) => {
        let feePerKb = inFeePerKb;
        let gasPrice = inFeePerKb;
        const { from, data, outputs } = opts;
        const { coin, network } = wallet;
        this.walletService.estimateGas(
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
            return resolve(feePerKb);
          }
        );
      });
    });
  }

  getLevelsFee(p, feePerKb) {
    return [p, feePerKb];
  }

  checkTx(txp) {
    try {
      txp.getBitcoreTx();
    } catch (ex) {
      this.walletService.logw('Error building Bitcore transaction', ex);
      return ex;
    }
  }

  storeAndNotifyTx(txp, opts, cb) {
    txp.status = 'pending';
    this.walletService.storage.storeTx(
      this.walletService.walletId,
      txp,
      err => {
        if (err) return cb(err);

        this.walletService._notifyTxProposalAction('NewTxProposal', txp, () => {
          return cb(null, txp);
        });
      }
    );
  }

  selectTxInputs(txp, wallet, opts, cb, next) {
    this.walletService.getBalance({ wallet }, (err, balance) => {
      if (err) return next(err);

      const { totalAmount, availableAmount } = balance;
      if (totalAmount < txp.getTotalAmount()) {
        return cb(Errors.INSUFFICIENT_FUNDS);
      } else if (availableAmount < txp.getTotalAmount()) {
        return cb(Errors.LOCKED_FUNDS);
      } else {
        return next(this.walletService._checkTx(txp));
      }
    });
  }
}
