import { BitcoreLib } from 'crypto-wallet-core';
import _ from 'lodash';
import { IChain } from '..';
import { WalletService } from '../../../lib/server';
import { ClientError } from '../../errors/clienterror';
import { TxProposal } from '../../model';

const Common = require('../../common');
const Utils = Common.Utils;
const Defaults = Common.Defaults;
const Errors = require('../../errors/errordefinitions');

export class BtcChain implements IChain {
  protected walletService: WalletService;
  constructor(private bitcoreLib = BitcoreLib) {}

  init(server: WalletService) {
    this.walletService = server;
  }

  getWalletBalance(opts, cb) {
    this.walletService._getUtxosForCurrentWallet(
      {
        coin: opts.coin,
        addresses: opts.addresses
      },
      (err, utxos) => {
        if (err) return cb(err);

        const balance = {
          ...this.walletService._totalizeUtxos(utxos),
          byAddress: []
        };

        // Compute balance by address
        const byAddress = {};
        _.each(_.keyBy(_.sortBy(utxos, 'address'), 'address'), (value, key) => {
          byAddress[key] = {
            address: key,
            path: value.path,
            amount: 0
          };
        });

        _.each(utxos, utxo => {
          byAddress[utxo.address].amount += utxo.satoshis;
        });

        balance.byAddress = _.values(byAddress);

        return cb(null, balance);
      }
    );
  }

  getWalletSendMaxInfo(wallet, opts, cb) {
    this.walletService._getUtxosForCurrentWallet({}, (err, utxos) => {
      if (err) return cb(err);

      const info = {
        size: 0,
        amount: 0,
        fee: 0,
        feePerKb: 0,
        inputs: [],
        utxosBelowFee: 0,
        amountBelowFee: 0,
        utxosAboveMaxSize: 0,
        amountAboveMaxSize: 0
      };

      let inputs = _.reject(utxos, 'locked');
      if (!!opts.excludeUnconfirmedUtxos) {
        inputs = _.filter(inputs, 'confirmations');
      }
      inputs = _.sortBy(inputs, input => {
        return -input.satoshis;
      });

      if (_.isEmpty(inputs)) return cb(null, info);

      this.walletService._getFeePerKb(wallet, opts, (err, feePerKb) => {
        if (err) return cb(err);

        info.feePerKb = feePerKb;

        const txp = TxProposal.create({
          walletId: this.walletService.walletId,
          coin: wallet.coin,
          network: wallet.network,
          walletM: wallet.m,
          walletN: wallet.n,
          feePerKb
        });

        const baseTxpSize = txp.getEstimatedSize();
        const sizePerInput = txp.getEstimatedSizeForSingleInput();
        const feePerInput = (sizePerInput * txp.feePerKb) / 1000;

        const partitionedByAmount = _.partition(inputs, input => {
          return input.satoshis > feePerInput;
        });

        info.utxosBelowFee = partitionedByAmount[1].length;
        info.amountBelowFee = _.sumBy(partitionedByAmount[1], 'satoshis');
        inputs = partitionedByAmount[0];

        _.each(inputs, (input, i) => {
          const sizeInKb = (baseTxpSize + (i + 1) * sizePerInput) / 1000;
          if (sizeInKb > Defaults.MAX_TX_SIZE_IN_KB[wallet.coin]) {
            info.utxosAboveMaxSize = inputs.length - i;
            info.amountAboveMaxSize = _.sumBy(_.slice(inputs, i), 'satoshis');
            return false;
          }
          txp.inputs.push(input);
        });

        if (_.isEmpty(txp.inputs)) return cb(null, info);

        const fee = txp.getEstimatedFee();
        const amount = _.sumBy(txp.inputs, 'satoshis') - fee;

        if (amount < Defaults.MIN_OUTPUT_AMOUNT) return cb(null, info);

        info.size = txp.getEstimatedSize();
        info.fee = fee;
        info.amount = amount;

        if (opts.returnInputs) {
          info.inputs = _.shuffle(txp.inputs);
        }

        return cb(null, info);
      });
    });
  }

  getDustAmountValue() {
    return this.bitcoreLib.Transaction.DUST_AMOUNT;
  }

  getTransactionCount() {
    return null;
  }

  getChangeAddress(wallet, opts) {
    return new Promise((resolve, reject) => {
      const getChangeAddress = (wallet, cb) => {
        if (wallet.singleAddress) {
          this.walletService.storage.fetchAddresses(
            this.walletService.walletId,
            (err, addresses) => {
              if (err) return cb(err);
              if (_.isEmpty(addresses))
                return cb(new ClientError('The wallet has no addresses'));
              return cb(null, _.head(addresses));
            }
          );
        } else {
          if (opts.changeAddress) {
            const addrErr = this.walletService._validateAddr(
              wallet,
              opts.changeAddress,
              opts
            );
            if (addrErr) return cb(addrErr);

            this.walletService.storage.fetchAddressByWalletId(
              wallet.id,
              opts.changeAddress,
              (err, address) => {
                if (err || !address) return cb(Errors.INVALID_CHANGE_ADDRESS);
                return cb(null, address);
              }
            );
          } else {
            return cb(null, wallet.createAddress(true), true);
          }
        }
      };

      getChangeAddress(wallet, (err, address, isNew) => {
        if (err) return reject(err);
        return resolve(address);
      });
    });
  }

  checkErrorOutputs(output) {
    const dustThreshold = Math.max(
      Defaults.MIN_OUTPUT_AMOUNT,
      this.bitcoreLib.Transaction.DUST_AMOUNT
    );

    if (output.amount < dustThreshold) {
      return Errors.DUST_AMOUNT;
    }
  }

  getFeePerKb(wallet, opts) {
    return new Promise(resolve => {
      this.walletService._getFeePerKb(wallet, opts, (err, inFeePerKb) => {
        return resolve(inFeePerKb);
      });
    });
  }

  getLevelsFee(p, feePerKb) {
    return [p, Utils.strip(feePerKb * 1e8)];
  }

  checkTx(txp) {
    let bitcoreError;

    const serializationOpts = {
      disableIsFullySigned: true,
      disableSmallFees: true,
      disableLargeFees: true
    };
    if (_.isEmpty(txp.inputPaths)) return Errors.NO_INPUT_PATHS;

    try {
      const bitcoreTx = txp.getBitcoreTx();
      bitcoreError = bitcoreTx.getSerializationError(serializationOpts);
      if (!bitcoreError) {
        txp.fee = bitcoreTx.getFee();
      }
    } catch (ex) {
      this.walletService.logw('Error building Bitcore transaction', ex);
      return ex;
    }

    if (bitcoreError instanceof this.bitcoreLib.errors.Transaction.FeeError)
      return Errors.INSUFFICIENT_FUNDS_FOR_FEE;

    if (bitcoreError instanceof this.bitcoreLib.errors.Transaction.DustOutputs)
      return Errors.DUST_AMOUNT;
    return bitcoreError;
  }

  storeAndNotifyTx(txp, opts, cb) {
    log.debug('Rechecking UTXOs availability for publishTx');

    const utxoKey = utxo => {
      return utxo.txid + '|' + utxo.vout;
    };

    this.walletService._getUtxosForCurrentWallet(
      {
        addresses: txp.inputs
      },
      (err, utxos) => {
        if (err) return cb(err);

        const txpInputs = _.map(txp.inputs, utxoKey);
        const utxosIndex = _.keyBy(utxos, utxoKey);
        const unavailable = _.some(txpInputs, i => {
          const utxo = utxosIndex[i];
          return !utxo || utxo.locked;
        });

        if (unavailable) return cb(Errors.UNAVAILABLE_UTXOS);

        txp.status = 'pending';
        this.walletService.storage.storeTx(
          this.walletService.walletId,
          txp,
          err => {
            if (err) return cb(err);

            this.walletService._notifyTxProposalAction(
              'NewTxProposal',
              txp,
              () => {
                return cb(null, txp);
              }
            );
          }
        );
      }
    );
  }

  selectTxInputs(txp, wallet, opts, cb, next) {
    return this.walletService._selectTxInputs(txp, opts.utxosToExclude, next);
  }
}
